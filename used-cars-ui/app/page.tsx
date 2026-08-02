// app/page.tsx
"use client";

import { useState } from "react";
// هنا بنستدعي الداتا اللي حطيناها في الملف التاني
import { selectOptions, modelsByManufacturer } from "./data"; 

export default function CarPricePredictor() {
  const [formData, setFormData] = useState({
    region: "",
    year: "",
    manufacturer: "",
    model: "",
    condition: "",
    cylinders: "",
    fuel: "",
    odometer: "",
    title_status: "",
    transmission: "",
    drive: "",
    type: "",
    paint_color: "",
    state: "",
  });

  const [predictedPrice, setPredictedPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // لو غير الماركة، نفضي الموديل عشان ميحصلش تعارض
    if (name === "manufacturer") {
      setFormData({ ...formData, manufacturer: value, model: "" });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPredictedPrice(null);

    const payload = {
      ...formData,
      year: Number(formData.year),
      odometer: Number(formData.odometer),
    };

    try {
      const response = await fetch(
        "https://used-cars-prices-prediction.onrender.com/predict",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error("حصلت مشكلة في الاتصال بالموديل. اتأكد إن كل البيانات صحيحة.");
      }

      const data = await response.json();
      setPredictedPrice(data.predicted_price);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fields = Object.keys(formData);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-8">
          AI Car Price Estimator
        </h1>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field} className="flex flex-col">
              <label className="mb-1 text-sm font-semibold text-gray-700 capitalize">
                {field.replace("_", " ")}
              </label>

              {field === "model" ? (
                // حقل الموديل معتمد على الماركة اللي اختارها اليوزر
                modelsByManufacturer[formData.manufacturer] ? (
                  <select
                    name="model"
                    value={formData.model}
                    onChange={handleChange}
                    required
                    className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="" disabled>Choose model...</option>
                    {modelsByManufacturer[formData.manufacturer].map((mod) => (
                      <option key={mod} value={mod}>
                        {mod.charAt(0).toUpperCase() + mod.slice(1)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="model"
                    value={formData.model}
                    onChange={handleChange}
                    required
                    disabled={!formData.manufacturer}
                    className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white placeholder-gray-400 disabled:bg-gray-100"
                    placeholder={formData.manufacturer ? "No specific models found" : "Choose manufacturer first"}
                  />
                )
              ) : 
              
              // باقي الحقول
              selectOptions[field] ? (
                <select
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                  required
                  className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="" disabled>Choose {field.replace("_", " ")}...</option>
                  {selectOptions[field].map((opt) => (
                    <option key={opt} value={opt}>
                      {field === 'year' ? opt : String(opt).charAt(0).toUpperCase() + String(opt).slice(1)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field === "odometer" ? "number" : "text"}
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                  required
                  className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white placeholder-gray-400"
                  placeholder={`Enter ${field.replace("_", " ")}`}
                />
              )}
            </div>
          ))}

          <div className="md:col-span-2 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {loading ? "Calculating..." : "Predict Price"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-100 text-red-700 rounded text-center">
            {error}
          </div>
        )}

        {predictedPrice && (
          <div className="mt-6 p-6 bg-green-100 text-green-800 rounded-lg text-center shadow-inner">
            <h2 className="text-2xl font-bold">Estimated Price</h2>
            <p className="text-4xl mt-2 font-extrabold text-green-700">
              ${Number(predictedPrice).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}