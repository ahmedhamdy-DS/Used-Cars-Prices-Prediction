"""
Used Car Price Prediction API
==============================
Loads:
  - XGBR.json               -> trained XGBRegressor (native XGBoost format)
  - preprocessing_pipeline.pkl -> fitted sklearn ColumnTransformer
  - encoding_maps.pkl        -> target-encoding lookup tables for
                                 'region' / 'model' + a numeric fallback
                                 for 'cylinders' (see notebook_addendum/)

Run with:
    uvicorn main:app --reload --port 8000
"""

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

# Exact column order the ColumnTransformer was fit with
# (num_cols + ordinal_cols + categ_cols + passthrough_cols from the notebook)
NUM_COLS = ["year", "cylinders", "odometer"]
ORDINAL_COLS = ["condition"]
CATEG_COLS = ["fuel", "title_status", "transmission", "drive", "type", "paint_color"]
PASSTHROUGH_COLS = ["condition_missing", "region", "model"]
COLS_ORDER = NUM_COLS + ORDINAL_COLS + CATEG_COLS + PASSTHROUGH_COLS

# -----------------------------------------------------------------
# App + CORS
# -----------------------------------------------------------------
app = FastAPI(title="Used Car Price Prediction API", version="1.0.0")

# FIX: allow_origins used to be hardcoded to localhost:3000 only, which blocks
# any frontend deployed elsewhere (Vercel/Netlify/etc). Set the ALLOWED_ORIGINS
# env var on Render to a comma-separated list, e.g.
#   ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.vercel.app
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


class PredictionResponse(BaseModel):
    estimated_price: float
    predicted_price: float  # alias of estimated_price, kept for frontend compatibility
    confidence_low: float
    confidence_high: float
    factors: list[PredictionFactor]


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


def build_feature_dataframe(car: CarFeatures) -> pd.DataFrame:
    """Builds a single-row DataFrame with exactly the columns/dtypes/order
    the ColumnTransformer was fit on.

    NOTE: 'manufacturer' and 'state' are accepted from the client for a
    better UX (manufacturer drives the cascading Model dropdown on the
    frontend) but were never part of the training feature set — the
    notebook's `cols_order` for the ColumnTransformer never included them.
    They are intentionally not used below.
    """
    row = {
        "year": float(car.year),
        "cylinders": extract_cylinders(car.cylinders),
        "odometer": float(car.odometer),
        "condition": car.condition,
        "fuel": car.fuel,
        "title_status": car.title_status,
        "transmission": car.transmission,
        "drive": car.drive,
        "type": car.type,
        "paint_color": car.paint_color,
        # The form always supplies a condition, so this flag is always 0 at inference time
        # (it only ever became 1 in training for rows where 'condition' was missing from the raw dataset).
        "condition_missing": 0.0,
        # Target-encode high-cardinality columns using the training-set lookup tables.
        # Unseen categories fall back to the global mean price (same behaviour as
        # kfold_target_encode()'s .fillna(global_mean) in the notebook).
        "region": REGION_MAP.get(car.region, GLOBAL_MEAN_PRICE),
        "model": MODEL_MAP.get(car.model, GLOBAL_MEAN_PRICE),
    }

    df = pd.DataFrame([row])

    # Explicit dtype casting as requested: numeric columns -> float,
    # object/string columns stay as plain Python strings (the pipeline's
    # OneHotEncoder/OrdinalEncoder operate on string categories, not
    # pandas 'category' dtype — casting to 'category' here would not
    # change behaviour since these go through sklearn encoders, not
    # XGBoost's native categorical handling).
    numeric_cols = ["year", "cylinders", "odometer", "condition_missing", "region", "model"]
    df[numeric_cols] = df[numeric_cols].astype(float)

    string_cols = ["condition", "fuel", "title_status", "transmission", "drive", "type", "paint_color"]
    df[string_cols] = df[string_cols].astype(str)

    return df[COLS_ORDER]


def mock_confidence_interval(price: float) -> tuple[float, float]:
    """Illustrative +/- band, not a real prediction interval."""
    margin = max(1000.0, round(price * 0.08, -2))
    return round(price - margin, 2), round(price + margin, 2)


def mock_factors(car: CarFeatures, price: float) -> list[PredictionFactor]:
    """Illustrative, rule-of-thumb 'what moved the price' bullets for the UI.
    These are NOT derived from SHAP/feature-importance on the actual model —
    swap this out for a real SHAP explainer if/when you want true attributions."""
    factors: list[PredictionFactor] = []

    if car.odometer > 120000:
        factors.append(PredictionFactor(label="High odometer reading", impact=-round(price * 0.10, -1)))
    elif car.odometer < 40000:
        factors.append(PredictionFactor(label="Low odometer reading", impact=round(price * 0.08, -1)))

    age = 2026 - car.year
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


# -----------------------------------------------------------------
# Routes
# -----------------------------------------------------------------
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
        predicted_price = float(model.predict(transformed)[0])
        predicted_price = max(predicted_price, 0.0)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Prediction failed: {exc}") from exc

    low, high = mock_confidence_interval(predicted_price)
    factors = mock_factors(car, predicted_price)

    return PredictionResponse(
        estimated_price=round(predicted_price, 2),
        predicted_price=round(predicted_price, 2),
        confidence_low=low,
        confidence_high=high,
        factors=factors,
    )

