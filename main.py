from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import xgboost as xgb
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Car Price Prediction API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Car Price Prediction API! Go to /docs to test the model."}
  
pipeline = joblib.load("preprocessing_pipeline.pkl")

model = xgb.XGBRegressor()
model.load_model("XGBR.json")

class ModelInput(BaseModel):
    region: str
    year: int
    manufacturer: str
    model: str
    condition: str
    cylinders: str
    fuel: str
    odometer: float
    title_status: str
    transmission: str
    drive: str
    type: str
    paint_color: str
    state: str

@app.post("/predict")
def predict(data: ModelInput):
    
    input_df = pd.DataFrame([data.model_dump()])
    

    input_df['condition_missing'] = 0

    processed_data = pipeline.transform(input_df)
    
    prediction = model.predict(processed_data)
    
    return {
        "status": "success",
        "predicted_price": float(prediction[0])
    }
    
