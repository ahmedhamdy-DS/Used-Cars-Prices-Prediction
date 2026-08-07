# AutoValuate — AI Car Price Estimator

> Instant, AI-powered valuations for used vehicles — trained on real-world Craigslist listing data.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/XGBoost-006ACC?style=for-the-badge" alt="XGBoost" />
  <img src="https://img.shields.io/badge/Scikit--Learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white" alt="Scikit-Learn" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Render" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-active-success?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome" />
  <br><br>
  <a href="https://used-cars-prices-prediction-la86-chi.vercel.app/">
    <img src="https://img.shields.io/badge/Live%20Demo-Open%20Dashboard-orange?style=flat-square" alt="Live Demo" />
  </a>
</p>


<img src="./used-cars-ui/public/car.png" alt="Hieroglyphs-AI overview" width="800"/>


## Overview
**AutoValuate** is a full-stack machine learning application that estimates the fair market value of a used car in seconds. A user answers a short, guided form about their vehicle — make, model, condition, mileage, and location — and a trained **XGBoost** regression model, backed by a **scikit-learn** preprocessing pipeline, returns an instant price estimate along with a confidence range and the key factors driving the valuation.

Under the hood, the model was trained on the well-known **Craigslist used vehicles dataset**, using target encoding for high-cardinality categorical features (like region and model) to keep the pipeline both accurate and production-friendly. The result is wrapped in a clean **FastAPI** REST service and a polished, modern **Next.js** interface — giving it the feel of a real SaaS product rather than a notebook demo.

---

## Features

- **Instant AI Valuation** — get a price estimate in under a second from a trained XGBoost model.
- **Modern SaaS UI** — a clean, multi-step form built with Next.js, React, and Tailwind CSS.
- **Graceful Handling of Out-of-Distribution Data** — unseen regions/models gracefully fall back to sensible global averages instead of breaking the prediction.
- **Explainability Snippets** — human-readable "factors influencing this price" alongside every estimate.
- **Clean REST API** — a documented FastAPI backend that any frontend (web, mobile, or third-party) can consume.
- **Production Deployment** — frontend on Vercel, backend on Render, fully decoupled and independently scalable.

---

## Tech Stack & Architecture

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js · React · Tailwind CSS · TypeScript |
| **Backend** | FastAPI · Python 3.11 · Uvicorn · Pydantic |
| **Machine Learning** | XGBoost · Scikit-Learn (ColumnTransformer, OneHotEncoder, OrdinalEncoder, RobustScaler, FunctionTransformer) · Pandas · NumPy · Target Encoding |
| **Deployment** | Vercel (frontend) · Render + Docker (backend) |

### System architecture

```mermaid
flowchart LR
    A["Next.js UI (Vercel)"] -- "POST /predict (JSON)" --> B["FastAPI Server (Render / Docker)"]
    B -- "estimated_price, range, factors" --> A
    B --> C["Preprocessing Pipeline (sklearn ColumnTransformer)"]
    C --> D["Trained XGBoost Model (XGBR.json)"]
    B --> E["Target-Encoding Lookup Tables (encoding_maps.pkl)"]
    D -- "raw prediction" --> B
```

### Request lifecycle (sequence)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Next.js Frontend
    participant A as FastAPI Backend
    participant P as Preprocessing Pipeline
    participant M as XGBoost Model

    U->>F: Fill in vehicle details (3-step form)
    F->>A: POST /predict {region, year, model, condition, ...}
    A->>A: Validate payload (Pydantic schema)
    A->>A: Encode region/model via target-encoding maps
    A->>P: transform(features_df)
    P-->>A: Transformed feature matrix
    A->>M: predict(transformed)
    M-->>A: Raw predicted price
    A->>A: Clamp to >= 0, build confidence range & factors
    A-->>F: {estimated_price, confidence_low/high, factors}
    F-->>U: Render valuation result
```

### ML preprocessing pipeline

```mermaid
flowchart TD
    subgraph Input Features
        N["Numeric: year, cylinders, odometer"]
        O["Ordinal: condition"]
        C["Categorical: fuel, title_status, transmission, drive, type, paint_color"]
        T["Target-Encoded: region, model"]
    end

    N --> RS["RobustScaler"]
    O --> OE["OrdinalEncoder"]
    C --> OH["OneHotEncoder"]
    T --> FT["FunctionTransformer (identity, precomputed)"]

    RS --> CT["ColumnTransformer"]
    OE --> CT
    OH --> CT
    FT --> CT

    CT --> XGB["XGBoost Regressor"]
    XGB --> OUT["Predicted Price"]
```

---

## Folder Structure

```
Used-Cars-Prices-Prediction/
├── used-cars-ui/                  # Next.js frontend
│   ├── app/
│   │   ├── page.tsx               # Main multi-step valuation form
│   │   ├── data.js                # Static dropdown data (makes, models, regions...)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── public/
│   ├── package.json
│   └── next.config.ts
│
├── main.py                        # FastAPI application & inference logic
├── Dockerfile                     # Container definition for Render deployment
├── requirements.txt                # Backend Python dependencies
├── XGBR.json                       # Trained XGBoost model (native format)
├── preprocessing_pipeline.pkl      # Fitted sklearn ColumnTransformer
├── encoding_maps.pkl                # Target-encoding lookup tables
├── Datapre_modeling.ipynb          # Data preprocessing & model training notebook
├── Exploratory Data Analysis.ipynb # EDA notebook
└── README.md
```

---

## Getting Started / Local Setup

### Prerequisites

- **Node.js** >= 18
- **Python** >= 3.11
- `git`

### 1. Clone the repository

```bash
git clone https://github.com/ahmedhamdy-DS/Used-Cars-Prices-Prediction.git
cd Used-Cars-Prices-Prediction
```

### 2. Run the backend (FastAPI)

```bash
# From the repo root
pip install -r requirements.txt

uvicorn main:app --reload --port 8000
```

The API will be available at **`http://localhost:8000`**, with interactive docs at **`http://localhost:8000/docs`**.

### 3. Run the frontend (Next.js)

```bash
# In a new terminal, from the repo root
cd used-cars-ui
npm install
npm run dev
```

The app will be available at **`http://localhost:3000`**.

### 4. Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `ALLOWED_ORIGINS` | Backend (Render) | Comma-separated list of frontend origins allowed to call the API (CORS) |

```bash
# Example
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.vercel.app
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check — confirms the model and pipeline are loaded correctly |
| `POST` | `/predict` | Accepts vehicle details and returns an estimated price, confidence range, and contributing factors |
| `GET` | `/docs` | Interactive Swagger UI for exploring and testing the API |

**Example request body for `POST /predict`:**

```json
{
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
  "state": "ca"
}
```

**Example response:**

```json
{
  "estimated_price": 13799.63,
  "predicted_price": 13799.63,
  "confidence_low": 12699.63,
  "confidence_high": 14899.63,
  "factors": [
    { "label": "Typical specs for this segment", "impact": 0 }
  ]
}
```

---

## Technical Notes

- **Target encoding**: `region` and `model` are high-cardinality categorical fields (thousands of distinct values), so they are encoded using precomputed mean-target lookup tables (`encoding_maps.pkl`) rather than one-hot encoding, keeping the feature space compact. Unseen categories at inference time fall back to the global mean price.
- **Column order**: the FastAPI service reconstructs the exact column order the `ColumnTransformer` was fit with (`NUM_COLS + ORDINAL_COLS + CATEG_COLS + PASSTHROUGH_COLS`) before calling `.transform()`, since scikit-learn pipelines are order-sensitive.
- **Model format**: the XGBoost model is persisted in its native `.json` format (`XGBR.json`) rather than pickled, for better long-term compatibility across XGBoost versions.
- **Version pinning**: `requirements.txt` pins `scikit-learn`, `xgboost`, and `numpy` to the exact versions used during training to avoid `InconsistentVersionWarning` issues and silently degraded predictions when unpickling the preprocessing pipeline.
- **CORS**: the backend reads allowed frontend origins from the `ALLOWED_ORIGINS` environment variable at startup, so new frontend deployments can be authorized without changing code.

---

## Author & Links

**Ahmed Hamdy**

- LinkedIn: [linkedin.com/in/My-profile](https://www.linkedin.com/in/ahmed-hamdy-4569a8360/)
- Portfolio: [my-web-3ciq.vercel.app](https://my-web-3ciq.vercel.app/)
- GitHub: [@ahmedhamdy-DS](https://github.com/ahmedhamdy-DS)

---

<p align="center">Made with care and a lot of debugging.</p>
