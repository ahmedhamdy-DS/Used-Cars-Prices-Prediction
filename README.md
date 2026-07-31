# 🚗 AutoValuate — Used Vehicle Price Predictor

A full end-to-end Machine Learning project that predicts the **fair market value of used vehicles** from the Craigslist vehicles dataset, wrapped in a polished, SaaS-style **Streamlit** dashboard for interactive exploration and real-time price prediction.

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-blue?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Streamlit-App-FF4B4B?logo=streamlit&logoColor=white" />
  <img src="https://img.shields.io/badge/scikit--learn-ML-F7931E?logo=scikitlearn&logoColor=white" />
  <img src="https://img.shields.io/badge/XGBoost-Model-blue" />
  <img src="https://img.shields.io/badge/LightGBM-Model-brightgreen" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## 📌 Overview

This project walks through the complete data science lifecycle — from raw, messy real-world data to a deployed prediction engine:

1. **Exploratory Data Analysis (EDA)** — deep-dive into a large used-car listings dataset (missing values, distributions, categorical breakdowns, time-based posting features).
2. **Data Preprocessing & Modeling** — leakage-safe cleaning pipeline, outlier removal, K-Fold target encoding, and benchmarking of multiple regression models.
3. **Deployment** — an interactive multi-page **Streamlit** web app that loads the trained pipeline/model and returns instant price estimates for any vehicle configuration.

---

## ✨ Features

- 🏠 **Home & Data Overview** — dataset snapshot and key statistics at a glance.
- 📊 **Market Insights (EDA)** — interactive Plotly visualizations of price trends by manufacturer, condition, mileage, and more.
- 🤖 **Price Predictor Engine** — a clean input form (manufacturer, model, year, odometer, condition, fuel, transmission, drive, type, paint color, region, title status) that returns an instant fair-market-value estimate.
- 🎨 **Custom dark, SaaS-style UI** — hand-crafted CSS theming (gradient backgrounds, glowing metric cards, animated buttons) instead of default Streamlit styling.
- 🛡️ **Graceful fallbacks** — the app never crashes: it falls back to synthetic demo data if the raw dataset is missing, and clearly reports if model artifacts aren't found.

---

## 🧠 Machine Learning Pipeline

The modeling notebook (`Datapre_modeling.ipynb`) builds a leakage-safe pipeline:

| Step | Technique |
|---|---|
| Missing-value handling | Column-wise dropping for low-missing features + group-wise (manufacturer/model) mode imputation |
| Outlier removal | IQR-based filtering on price and odometer, plus sane year/mileage bounds |
| Categorical encoding | One-Hot Encoding (nominal), Ordinal Encoding (vehicle condition), K-Fold smoothed target encoding for high-cardinality columns |
| Numerical scaling | `RobustScaler` |
| Models benchmarked | Random Forest, XGBoost, LightGBM |

### 📈 Model Performance (test set)

| Model | R² | MAE | RMSE |
|---|---|---|---|
| **Random Forest** | **0.90** | **$2,163** | **$3,923** |
| XGBoost | 0.87 | $2,900 | $4,537 |
| LightGBM | 0.86 | $3,077 | $4,742 |

Random Forest delivered the strongest performance and is the model served by the app.

---

## 🗂️ Project Structure

```
.
├── Exploratory_Data_Analysis.ipynb   # In-depth EDA: distributions, missingness, correlations
├── Datapre_modeling.ipynb            # Cleaning, feature engineering, encoding & model training
├── app.py                            # Streamlit dashboard (EDA viewer + live predictor)
├── preprocessing_pipeline.pkl        # Fitted sklearn ColumnTransformer/Pipeline (generated)
├── best_rf_model.pkl                 # Trained Random Forest model (generated)
├── vehicles.csv                      # Raw dataset (not included — see below)
└── README.md
```

> **Note:** The trained pipeline (`preprocessing_pipeline.pkl`) and model (`best_rf_model.pkl`) are produced by running `Datapre_modeling.ipynb`. They are not committed to this repository due to file size — generate them locally by running the notebook before launching the app.

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- The [Craigslist Used Vehicles dataset](https://www.kaggle.com/datasets/austinreese/craigslist-carstrucks-data) saved as `vehicles.csv` in the project root (optional — the app falls back to synthetic demo data if absent).

### Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>

# Create a virtual environment
python -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Train the model

Run `Datapre_modeling.ipynb` end-to-end to generate `preprocessing_pipeline.pkl` and the trained model file in the project root.

### Run the app

```bash
streamlit run app.py
```

The dashboard will open at `http://localhost:8501`.

---

## 🛠️ Tech Stack

- **Language:** Python
- **Data & ML:** pandas, NumPy, scikit-learn, XGBoost, LightGBM, joblib
- **Visualization:** Matplotlib, Seaborn, missingno, Plotly
- **Web App:** Streamlit
- **Environment:** Jupyter Notebook

---

## 🔮 Future Improvements

- Hyperparameter tuning (GridSearch/Optuna) for further error reduction
- SHAP-based explainability for individual predictions
- Model versioning and CI/CD deployment (Docker + cloud hosting)
- Expanding the dataset with more recent listings

---

## 👤 Author

**Ahmed Hamdy**

- 💼 Portfolio: [my-web-3ciq.vercel.app](https://my-web-3ciq.vercel.app/)
- 🔗 LinkedIn: [linkedin.com/in/ahmed-hamdy-4569a8360](https://www.linkedin.com/in/ahmed-hamdy-4569a8360/)

---

## 📄 License

This project is licensed under the MIT License — feel free to use, modify, and build upon it.

---

<p align="center">⭐ If you found this project useful, consider giving it a star!</p>
