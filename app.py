
import os
import joblib
import numpy as np
import pandas as pd
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go

# =================================================================================
# 1. PAGE CONFIGURATION
# =================================================================================
st.set_page_config(
    page_title="AutoValuate | Used Vehicle Price Predictor",
    page_icon="🚗",
    layout="wide",
    initial_sidebar_state="expanded",
)

# =================================================================================
# 2. GLOBAL CONSTANTS
# =================================================================================
DATA_PATH = "vehicles.csv"
PIPELINE_PATH = "preprocessing_pipeline.pkl"
MODEL_PATH = "XGBR.pkl"

CONDITION_OPTIONS = ["salvage", "fair", "good", "excellent", "like new", "new"]
CYLINDER_OPTIONS = ["3 cylinders", "4 cylinders", "5 cylinders", "6 cylinders",
                     "8 cylinders", "10 cylinders", "12 cylinders", "other"]
FUEL_OPTIONS = ["gas", "diesel", "hybrid", "electric", "other"]
TRANSMISSION_OPTIONS = ["automatic", "manual", "other"]
DRIVE_OPTIONS = ["fwd", "rwd", "4wd"]
TYPE_OPTIONS = ["sedan", "SUV", "truck", "coupe", "hatchback", "van",
                "convertible", "wagon", "mini-van", "pickup", "other"]
PAINT_OPTIONS = ["white", "black", "silver", "grey", "blue", "red",
                 "brown", "green", "custom", "orange", "yellow", "purple"]
TITLE_STATUS_OPTIONS = ["clean", "rebuilt", "salvage", "lien", "missing", "parts only"]
MANUFACTURER_OPTIONS = ["ford", "chevrolet", "toyota", "honda", "nissan", "jeep",
                         "ram", "gmc", "bmw", "mercedes-benz", "dodge", "subaru",
                         "hyundai", "kia", "volkswagen", "lexus", "audi", "cadillac",
                         "chrysler", "mazda", "buick", "acura", "infiniti", "volvo"]

# =================================================================================
# 3. CUSTOM CSS — PREMIUM SAAS DASHBOARD LOOK & FEEL
# =================================================================================
def inject_custom_css():
    """Injects custom CSS to hide Streamlit chrome and restyle core widgets."""
    st.markdown(
        """
        <style>
            /* ---- Hide default Streamlit menu, footer & header ---- */
            #MainMenu {visibility: hidden;}
            footer {visibility: hidden;}
            header {visibility: hidden;}

            /* ---- Global font & background ---- */
            html, body, [class*="css"] {
                font-family: 'Segoe UI', 'Inter', sans-serif;
            }
            .stApp {
                background: linear-gradient(180deg, #0f1116 0%, #14171f 100%);
            }

            /* ---- Sidebar styling ---- */
            section[data-testid="stSidebar"] {
                background: linear-gradient(180deg, #1a1d29 0%, #12131a 100%);
                border-right: 1px solid #2a2e3d;
            }
            section[data-testid="stSidebar"] .stRadio label {
                font-size: 16px;
                padding: 6px 0px;
            }

            /* ---- Metric cards ---- */
            div[data-testid="stMetric"] {
                background: linear-gradient(145deg, #1b1f2b, #202538);
                border: 1px solid #2e3346;
                padding: 20px 15px;
                border-radius: 16px;
                box-shadow: 0 4px 18px rgba(0,0,0,0.35);
                transition: transform 0.2s ease-in-out;
            }
            div[data-testid="stMetric"]:hover {
                transform: translateY(-4px);
                border-color: #6C63FF;
            }
            div[data-testid="stMetricLabel"] {
                color: #9aa1b9 !important;
                font-weight: 600;
            }
            div[data-testid="stMetricValue"] {
                color: #ffffff !important;
                font-size: 1.9rem !important;
            }

            /* ---- Buttons ---- */
            .stButton > button {
                background: linear-gradient(90deg, #6C63FF 0%, #4834d4 100%);
                color: white;
                border: none;
                border-radius: 12px;
                padding: 0.7em 1.6em;
                font-weight: 700;
                font-size: 1rem;
                letter-spacing: 0.3px;
                box-shadow: 0 4px 14px rgba(108, 99, 255, 0.35);
                transition: all 0.2s ease-in-out;
                width: 100%;
            }
            .stButton > button:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(108, 99, 255, 0.5);
                background: linear-gradient(90deg, #7a72ff 0%, #5a44e8 100%);
            }

            /* ---- Headers ---- */
            h1, h2, h3 {
                color: #ffffff;
                font-weight: 800;
            }
            .subtitle-text {
                color: #9aa1b9;
                font-size: 1.05rem;
                margin-top: -10px;
            }

            /* ---- Expander ---- */
            div[data-testid="stExpander"] {
                background-color: #171a24;
                border: 1px solid #2a2e3d;
                border-radius: 12px;
            }

            /* ---- Success box (prediction result) ---- */
            div[data-testid="stSuccess"] {
                background: linear-gradient(90deg, rgba(46,213,115,0.15), rgba(46,213,115,0.05));
                border: 1px solid #2ed573;
                border-radius: 16px;
                padding: 1.2rem;
            }

            /* ---- Dataframe ---- */
            .stDataFrame {
                border-radius: 12px;
                overflow: hidden;
            }
        </style>
        """,
        unsafe_allow_html=True,
    )


# =================================================================================
# 4. DATA LOADING (cached) — with graceful fallback to synthetic sample
# =================================================================================
@st.cache_data(show_spinner="Loading dataset...")
def load_data(path: str = DATA_PATH) -> pd.DataFrame:
    """
    Loads the raw vehicle dataset for the Home & EDA pages.
    Falls back to a small synthetic sample if the CSV is not found,
    so the dashboard remains fully demo-able without the original data.
    """
    try:
        if os.path.exists(path):
            df = pd.read_csv(path)
            return df
        else:
            raise FileNotFoundError
    except Exception:
        # ---- Fallback: synthetic demo data (clearly for display purposes only) ----
        rng = np.random.default_rng(42)
        n = 2000
        manufacturers = rng.choice(MANUFACTURER_OPTIONS, size=n)
        df = pd.DataFrame({
            "manufacturer": manufacturers,
            "price": rng.normal(18000, 9000, n).clip(500, 90000).round(0),
            "odometer": rng.normal(95000, 45000, n).clip(0, 300000).round(0),
            "year": rng.integers(2000, 2023, n),
            "condition": rng.choice(CONDITION_OPTIONS, size=n),
            "fuel": rng.choice(FUEL_OPTIONS, size=n),
            "transmission": rng.choice(TRANSMISSION_OPTIONS, size=n),
        })
        return df


@st.cache_resource(show_spinner="Loading trained pipeline & model...")
def load_pipeline_and_model():

    try:
        if not os.path.exists(PIPELINE_PATH) or not os.path.exists(MODEL_PATH):
            missing = [p for p in [PIPELINE_PATH, MODEL_PATH] if not os.path.exists(p)]
            return None, None, (
                f" Missing required file(s): {', '.join(missing)}. "
                f"Please place them in the app's working directory."
            )
        pipeline = joblib.load(PIPELINE_PATH)
        model = joblib.load(MODEL_PATH)
        return pipeline, model, None
    except Exception as e:
        return None, None, f" Failed to load model artifacts: {e}"


# =================================================================================
# 5. PAGE 1 — HOME & DATA OVERVIEW
# =================================================================================
def render_home_page(df: pd.DataFrame):
    st.markdown("#  Used Vehicle Price Predictor")
    st.markdown(
        '<p class="subtitle-text">An end-to-end Machine Learning platform that '
        'evaluates the fair market value of used vehicles using a tuned '
        'Random Forest Regressor trained on real-world listings.</p>',
        unsafe_allow_html=True,
    )
    st.write("")

    # ---- Defensive column access: dataset may vary in structure ----
    price_col = "price" if "price" in df.columns else None
    manuf_col = "manufacturer" if "manufacturer" in df.columns else None

    total_cars = len(df)
    avg_price = df[price_col].mean() if price_col else np.nan
    num_manufacturers = df[manuf_col].nunique() if manuf_col else np.nan
    max_price = df[price_col].max() if price_col else np.nan

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("🚘 Total Cars Evaluated", f"{total_cars:,}")
    with col2:
        st.metric("💰 Average Market Price",
                   f"${avg_price:,.0f}" if not np.isnan(avg_price) else "N/A")
    with col3:
        st.metric("🏭 Manufacturers Covered",
                   f"{num_manufacturers}" if not np.isnan(num_manufacturers) else "N/A")
    with col4:
        st.metric("🔝 Highest Listed Price",
                   f"${max_price:,.0f}" if not np.isnan(max_price) else "N/A")

    st.write("")
    st.markdown("### About this Tool")
    st.info(
        "This platform was built on a rigorously validated ML pipeline that handles "
        "**data leakage prevention**, **K-Fold target encoding** for high-cardinality "
        "categorical features, **RobustScaling** for outlier resilience, and "
        "**missing value imputation**. Navigate using the sidebar to explore market "
        "trends or generate a live price prediction."
    )

    with st.expander(" View Raw Dataset Sample"):
        st.dataframe(df.head(50), use_container_width=True)


# =================================================================================
# 6. PAGE 2 — MARKET INSIGHTS (EDA)
# =================================================================================
def render_eda_page(df: pd.DataFrame):
    st.markdown("# 📊 Market Insights")
    st.markdown(
        '<p class="subtitle-text">Interactive exploratory analysis of the '
        'underlying used-vehicle market data.</p>',
        unsafe_allow_html=True,
    )
    st.write("")

    plot_template = "plotly_dark"
    accent_color = "#6C63FF"

    col1, col2 = st.columns(2)

    # ---- Price Distribution ----
    with col1:
        st.markdown("#### 💵 Vehicle Price Distribution")
        if "price" in df.columns:
            price_data = df[(df["price"] > 0) & (df["price"] < df["price"].quantile(0.99))]
            fig_price = px.histogram(
                price_data, x="price", nbins=50,
                template=plot_template,
                color_discrete_sequence=[accent_color],
            )
            fig_price.update_layout(
                bargap=0.05, paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                xaxis_title="Price ($)", yaxis_title="Count", height=420,
            )
            st.plotly_chart(fig_price, use_container_width=True)
        else:
            st.warning("`price` column not found in dataset.")

    # ---- Odometer Distribution ----
    with col2:
        st.markdown("#### 🛣️ Odometer Reading Distribution")
        if "odometer" in df.columns:
            odo_data = df[(df["odometer"] >= 0) & (df["odometer"] < df["odometer"].quantile(0.99))]
            fig_odo = px.histogram(
                odo_data, x="odometer", nbins=50,
                template=plot_template,
                color_discrete_sequence=["#2ed573"],
            )
            fig_odo.update_layout(
                bargap=0.05, paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                xaxis_title="Odometer (miles)", yaxis_title="Count", height=420,
            )
            st.plotly_chart(fig_odo, use_container_width=True)
        else:
            st.warning("`odometer` column not found in dataset.")

    st.write("")

    # ---- Top 10 Manufacturers ----
    st.markdown("#### 🏭 Top 10 Manufacturers by Listing Count")
    if "manufacturer" in df.columns:
        top_manuf = df["manufacturer"].value_counts().head(10).reset_index()
        top_manuf.columns = ["manufacturer", "count"]
        fig_bar = px.bar(
            top_manuf, x="count", y="manufacturer", orientation="h",
            template=plot_template,
            color="count", color_continuous_scale="Purples",
        )
        fig_bar.update_layout(
            yaxis=dict(categoryorder="total ascending"),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            xaxis_title="Number of Listings", yaxis_title="", height=450,
            coloraxis_showscale=False,
        )
        st.plotly_chart(fig_bar, use_container_width=True)
    else:
        st.warning("`manufacturer` column not found in dataset.")


# =================================================================================
# 7. PAGE 3 — PRICE PREDICTOR ENGINE (INFERENCE)
# =================================================================================
def build_input_dataframe(user_inputs: dict) -> pd.DataFrame:
    """
    Converts the raw form inputs into a single-row DataFrame matching the
    schema the preprocessing pipeline expects, applying the same
    'condition_missing' flag logic used at training time.
    """
    data = dict(user_inputs)  # shallow copy

    # ---- Replicate training-time missing-value handling for 'condition' ----
    # If the user did not specify a condition, flag it and impute a neutral
    # placeholder — mirroring how NaNs were handled during preprocessing.
    if not data.get("condition") or data["condition"] == "Not Specified":
        data["condition_missing"] = 1
        data["condition"] = "good"  # neutral imputed value (matches training mode)
    else:
        data["condition_missing"] = 0

    return pd.DataFrame([data])


def render_prediction_form():
    """Renders the grouped input form and returns collected values as a dict."""
    user_inputs = {}

    with st.expander("🚙 Car Details", expanded=True):
        c1, c2, c3 = st.columns(3)
        with c1:
            user_inputs["manufacturer"] = st.selectbox("Manufacturer", MANUFACTURER_OPTIONS)
            user_inputs["model"] = st.text_input("Model", placeholder="e.g. f-150, camry, civic")
        with c2:
            user_inputs["year"] = st.number_input(
                "Year", min_value=1960, max_value=2026, value=2015, step=1
            )
            user_inputs["odometer"] = st.number_input(
                "Odometer (miles)", min_value=0, max_value=500000, value=75000, step=1000
            )
        with c3:
            user_inputs["condition"] = st.selectbox(
                "Condition", ["Not Specified"] + CONDITION_OPTIONS
            )

    with st.expander("⚙️ Specifications", expanded=True):
        c1, c2, c3 = st.columns(3)
        with c1:
            user_inputs["cylinders"] = st.selectbox("Cylinders", CYLINDER_OPTIONS)
            user_inputs["fuel"] = st.selectbox("Fuel Type", FUEL_OPTIONS)
        with c2:
            user_inputs["transmission"] = st.selectbox("Transmission", TRANSMISSION_OPTIONS)
            user_inputs["drive"] = st.selectbox("Drive Type", DRIVE_OPTIONS)
        with c3:
            user_inputs["type"] = st.selectbox("Vehicle Type", TYPE_OPTIONS)
            user_inputs["paint_color"] = st.selectbox("Paint Color", PAINT_OPTIONS)

    with st.expander("📍 Other Details", expanded=True):
        c1, c2 = st.columns(2)
        with c1:
            user_inputs["region"] = st.text_input("Region", placeholder="e.g. columbus, denver")
        with c2:
            user_inputs["title_status"] = st.selectbox("Title Status", TITLE_STATUS_OPTIONS)

    return user_inputs


def render_predictor_page():
    st.markdown("# 🤖 Price Predictor Engine")
    st.markdown(
        '<p class="subtitle-text">Fill in the vehicle details below to generate '
        'an instant, data-driven fair market value estimate.</p>',
        unsafe_allow_html=True,
    )
    st.write("")

    # ---- Load model artifacts (cached) ----
    pipeline, model, load_error = load_pipeline_and_model()

    if load_error:
        st.error(load_error)
        st.info(
            "The prediction engine cannot run without the trained pipeline and "
            "model files. Once `preprocessing_pipeline.pkl` and `best_rf_model.pkl` "
            "are available in the app directory, this page will activate automatically."
        )
        # Allow users to still preview the form in a disabled/demo capacity.
        with st.expander("👀 Preview the input form (inactive until model is loaded)"):
            render_prediction_form()
        return

    # ---- Collect user inputs via the organized form ----
    user_inputs = render_prediction_form()

    st.write("")
    predict_clicked = st.button("💰 Predict Fair Market Value", use_container_width=True)

    if predict_clicked:
        try:
            # ---- Basic validation: required numeric/text fields ----
            if not user_inputs.get("model"):
                st.warning("Please enter the vehicle **model** before predicting.")
                return
            if not user_inputs.get("region"):
                st.warning("Please enter the **region** before predicting.")
                return

            # ---- Build the single-row input frame matching training schema ----
            input_df = build_input_dataframe(user_inputs)

            # ---- Apply the exact same preprocessing used at training time ----
            # (K-Fold target encoding maps, RobustScaler, imputers are all
            # embedded inside the fitted pipeline object to prevent leakage.)
            transformed = pipeline.transform(input_df)

            # ---- Run inference through the trained Random Forest model ----
            prediction = model.predict(transformed)
            predicted_price = float(np.ravel(prediction)[0])
            predicted_price = max(predicted_price, 0)  # guard against negative output

            st.write("")
            st.success(
                f"### 🎉 Estimated Fair Market Value: **${predicted_price:,.2f}**"
            )

            # ---- Supplementary context metrics ----
            m1, m2, m3 = st.columns(3)
            with m1:
                st.metric("Estimated Price", f"${predicted_price:,.0f}")
            with m2:
                st.metric("Vehicle Age", f"{2026 - int(user_inputs['year'])} yrs")
            with m3:
                st.metric("Odometer", f"{int(user_inputs['odometer']):,} mi")

        except FileNotFoundError:
            st.error("⚠️ Model artifacts not found. Please check the app directory.")
        except ValueError as ve:
            st.error(
                f"⚠️ Input/schema mismatch during preprocessing: {ve}. "
                f"Verify that the input fields match the columns the pipeline "
                f"was originally fitted on."
            )
        except Exception as e:
            st.error(f"⚠️ An unexpected error occurred while predicting: {e}")


# =================================================================================
# 8. SIDEBAR NAVIGATION
# =================================================================================
def render_sidebar() -> str:
    with st.sidebar:
        st.markdown("## 🚗 AutoValuate")
        st.caption("Used Vehicle Intelligence Platform")
        st.write("")
        page = st.radio(
            "Navigate",
            [
                "🏠 Home & Data Overview",
                "📊 Market Insights (EDA)",
                "🤖 Price Predictor Engine",
            ],
            label_visibility="collapsed",
        )
        st.write("")
        st.markdown("---")
        st.caption(
            "Model: Random Forest Regressor\n\n"
            "Preprocessing: K-Fold Target Encoding · RobustScaler · Leakage-Safe Imputation"
        )
    return page


# =================================================================================
# 9. MAIN APPLICATION ENTRY POINT
# =================================================================================
def main():
    inject_custom_css()
    page = render_sidebar()

    # ---- Data is only needed for Home & EDA pages; loaded once and cached ----
    if page in ("🏠 Home & Data Overview", "📊 Market Insights (EDA)"):
        df = load_data()

    if page == "🏠 Home & Data Overview":
        render_home_page(df)
    elif page == "📊 Market Insights (EDA)":
        render_eda_page(df)
    elif page == "🤖 Price Predictor Engine":
        render_predictor_page()


if __name__ == "__main__":
    main()
