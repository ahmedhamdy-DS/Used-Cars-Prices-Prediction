from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import xgboost as xgb
import pandas as pd

app = FastAPI(title="Car Price Prediction API")
@app.get("/")
def read_root():
    return {"message": "Welcome to the Car Price Prediction API! Go to /docs to test the model."}
# 1. تحميل الـ Pipeline بتاع معالجة البيانات
pipeline = joblib.load("preprocessing_pipeline.pkl")

# 2. تحميل موديل XGBoost
model = xgb.XGBRegressor()
model.load_model("XGBR.json")

# 3. تحديد شكل البيانات اللي الـ API هيستقبلها (بدون عمود price)
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
    # تحويل البيانات لـ DataFrame عشان الـ Pipeline يقدر يتعامل معاها
    input_df = pd.DataFrame([data.model_dump()])
    
    # 1. تمرير البيانات على الـ Pipeline عشان يحصلها Preprocessing
    processed_data = pipeline.transform(input_df)
    
    # 2. تمرير البيانات المعالجة للموديل لاستخراج التوقع
    prediction = model.predict(processed_data)
    
    return {
        "status": "success",
        "predicted_price": float(prediction[0])
    }
    