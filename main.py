import os
import re
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# -----------------------------------------------------------------
# Paths / constants
# -----------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "XGBR.json")
PIPELINE_PATH = os.path.join(BASE_DIR, "preprocessing_pipeline.pkl")
ENCODING_MAPS_PATH = os.path.join(BASE_DIR, "encoding_maps.pkl")


CURRENT_YEAR = 2026

NUM_COLS = ["year", "cylinders", "odometer", "car_age", "miles_per_year"]
ORDINAL_COLS = ["condition"]
CATEG_COLS = ["fuel", "title_status", "transmission", "drive", "type", "paint_color"]
PASSTHROUGH_COLS = ["condition_missing", "region", "model"]
COLS_ORDER = NUM_COLS + ORDINAL_COLS + CATEG_COLS + PASSTHROUGH_COLS

app = FastAPI(title="Used Car Price Prediction API", version="1.0.0")


_default_origins = "http://localhost:3000"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", _default_origins).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------
# Load artifacts at startup
# -----------------------------------------------------------------
_missing = [p for p in (MODEL_PATH, PIPELINE_PATH, ENCODING_MAPS_PATH) if not os.path.exists(p)]
if _missing:
    raise RuntimeError(
        "Missing required artifact(s): "
        + ", ".join(_missing)
        + ". preprocessing_pipeline.pkl and encoding_maps.pkl are NOT part of the "
        "files you originally uploaded to me — run notebook_addendum/PASTE_INTO_NOTEBOOK.py "
        "in your notebook and copy the resulting files into backend/."
    )

model = xgb.XGBRegressor()
model.load_model(MODEL_PATH)

preprocessing_pipeline = joblib.load(PIPELINE_PATH)
encoding_maps = joblib.load(ENCODING_MAPS_PATH)

GLOBAL_MEAN_PRICE = encoding_maps["global_mean"]
CYLINDERS_FALLBACK = encoding_maps["cylinders_fallback"]
REGION_MAP = encoding_maps["region"]
MODEL_MAP = encoding_maps["model"]


# -----------------------------------------------------------------
# Request schema
# -----------------------------------------------------------------
class CarFeatures(BaseModel):
    region: str
    year: int = Field(..., ge=1900, le=2100)
    manufacturer: str  # collected for UX (filters the Model dropdown) — NOT a model input, see note below
    model: str
    condition: str
    cylinders: str  # e.g. "6 cylinders", "8 cylinders", "other"
    fuel: str
    odometer: float = Field(..., ge=0)
    title_status: str
    transmission: str
    drive: str
    type: str
    paint_color: str
    state: str  # collected for UX/completeness — NOT a model input, see note below

    class Config:
        json_schema_extra = {
            "example": {
                "region": "SF bay area",
                "year": 2015,
                "manufacturer": "toyota",
                "model": "camry",
                "condition": "good",
                "cylinders": "4 cylinders",
                "fuel": "gas",
                "odometer": 65000,
                "title_status": "clean",
                "transmission": "automatic",
                "drive": "fwd",
                "type": "sedan",
                "paint_color": "silver",
                "state": "ca",
            }
        }


class PredictionFactor(BaseModel):
    label: str
    impact: float  # signed dollar impact, mocked for display purposes



PRICE_FLOOR = 500.0
PRICE_CEILING = 150000.0


class PredictionResponse(BaseModel):
    estimated_price: float
    predicted_price: float  # alias of estimated_price, kept for frontend compatibility
    confidence_low: float
    confidence_high: float
    factors: list[PredictionFactor]
    low_confidence: bool  # True if the raw model output fell outside the training price range


# -----------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------
def extract_cylinders(raw: str) -> float:
    """'6 cylinders' -> 6.0. Falls back to the training-set mode for
    values with no digit in them (e.g. 'other')."""
    match = re.search(r"(\d+)", raw)
    if match:
        return float(match.group(1))
    return CYLINDERS_FALLBACK


def compute_car_age(year: int) -> float:
    """Matches Datapre_modeling.ipynb exactly:
        car_age = (CURRENT_YEAR - year).clip(lower=0)
    i.e. relative to the fixed CURRENT_YEAR the model was trained with,
    floored at 0 (not clamped away from 0 — see compute_miles_per_year for
    how the divide-by-zero case is handled, which also matches the
    notebook's `.replace(0, 1)`).
    """
    return max(float(CURRENT_YEAR - year), 0.0)


def compute_miles_per_year(odometer: float, car_age: float) -> float:
    """Matches Datapre_modeling.ipynb exactly:
        miles_per_year = odometer / car_age.replace(0, 1)
    i.e. a car_age of 0 (current-model-year vehicle) is treated as a
    divisor of 1, not 0.5 or any other value.
    """
    divisor = car_age if car_age != 0 else 1.0
    return odometer / divisor


def build_feature_dataframe(car: CarFeatures) -> pd.DataFrame:
    """Builds a single-row DataFrame with exactly the columns/dtypes/order
    the ColumnTransformer was fit on.

    NOTE: 'manufacturer' and 'state' are accepted from the client for a
    better UX (manufacturer drives the cascading Model dropdown on the
    frontend) but were never part of the training feature set — the
    notebook's `cols_order` for the ColumnTransformer never included them.
    They are intentionally not used below.
    """
    car_age = compute_car_age(car.year)
    miles_per_year = compute_miles_per_year(car.odometer, car_age)

    row = {
        "year": float(car.year),
        "cylinders": extract_cylinders(car.cylinders),
        "odometer": float(car.odometer),
        "car_age": car_age,
        "miles_per_year": miles_per_year,
        "condition": car.condition,
        "fuel": car.fuel,
        "title_status": car.title_status,
        "transmission": car.transmission,
        "drive": car.drive,
        "type": car.type,
        "paint_color": car.paint_color,

        "condition_missing": 0.0,

        "region": REGION_MAP.get(car.region, GLOBAL_MEAN_PRICE),
        "model": MODEL_MAP.get(car.model, GLOBAL_MEAN_PRICE),
    }

    df = pd.DataFrame([row])

    numeric_cols = [
        "year", "cylinders", "odometer", "car_age", "miles_per_year",
        "condition_missing", "region", "model",
    ]
    df[numeric_cols] = df[numeric_cols].astype(float)

    string_cols = ["condition", "fuel", "title_status", "transmission", "drive", "type", "paint_color"]
    df[string_cols] = df[string_cols].astype(str)

    return df[COLS_ORDER]


def mock_confidence_interval(price: float) -> tuple[float, float]:
    """Illustrative +/- band, not a real prediction interval."""
    margin = max(1000.0, round(price * 0.08, -2))
    return round(price - margin, 2), round(price + margin, 2)


def mock_factors(car: CarFeatures, price: float) -> list[PredictionFactor]:

    factors: list[PredictionFactor] = []

    if car.odometer > 120000:
        factors.append(PredictionFactor(label="High odometer reading", impact=-round(price * 0.10, -1)))
    elif car.odometer < 40000:
        factors.append(PredictionFactor(label="Low odometer reading", impact=round(price * 0.08, -1)))

    age = CURRENT_YEAR - car.year  # unclamped, for display purposes only
    if age > 12:
        factors.append(PredictionFactor(label="Older model year", impact=-round(price * 0.09, -1)))
    elif age < 4:
        factors.append(PredictionFactor(label="Recent model year", impact=round(price * 0.12, -1)))

    if car.condition in ("excellent", "like new", "new"):
        factors.append(PredictionFactor(label=f"{car.condition.title()} condition", impact=round(price * 0.06, -1)))
    elif car.condition in ("fair", "salvage"):
        factors.append(PredictionFactor(label=f"{car.condition.title()} condition", impact=-round(price * 0.12, -1)))

    if car.title_status != "clean":
        factors.append(PredictionFactor(label=f"Title status: {car.title_status}", impact=-round(price * 0.15, -1)))

    if not factors:
        factors.append(PredictionFactor(label="Typical specs for this segment", impact=0.0))

    return factors[:4]



@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "pipeline_loaded": preprocessing_pipeline is not None,
        "region_categories": len(REGION_MAP),
        "model_categories": len(MODEL_MAP),
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(car: CarFeatures):
    try:
        features_df = build_feature_dataframe(car)
        transformed = preprocessing_pipeline.transform(features_df)
        raw_prediction = float(model.predict(transformed)[0])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Prediction failed: {exc}") from exc

    low_confidence = raw_prediction < PRICE_FLOOR or raw_prediction > PRICE_CEILING
    predicted_price = min(max(raw_prediction, PRICE_FLOOR), PRICE_CEILING)

    low, high = mock_confidence_interval(predicted_price)
    factors = mock_factors(car, predicted_price)

    return PredictionResponse(
        estimated_price=round(predicted_price, 2),
        predicted_price=round(predicted_price, 2),
        confidence_low=low,
        confidence_high=high,
        factors=factors,
        low_confidence=low_confidence,
    )
