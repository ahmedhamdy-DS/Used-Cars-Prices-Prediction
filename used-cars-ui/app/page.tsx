"use client";

import { useMemo, useState } from "react";
import { selectOptions, modelsByManufacturer } from "./data";

const API_URL = "https://used-cars-prices-prediction.onrender.com/predict";

type FieldName =
  | "manufacturer"
  | "model"
  | "year"
  | "odometer"
  | "condition"
  | "cylinders"
  | "fuel"
  | "transmission"
  | "drive"
  | "type"
  | "title_status"
  | "paint_color"
  | "region"
  | "state";

type FormState = Record<FieldName, string>;
type FormErrors = Partial<Record<FieldName, string>>;

type Factor = { label: string; impact: number };

type PredictionResult = {
  price: number;
  low: number;
  high: number;
  factors: Factor[];
  lowConfidence: boolean;
};

const EMPTY_FORM: FormState = {
  manufacturer: "",
  model: "",
  year: "",
  odometer: "",
  condition: "",
  cylinders: "",
  fuel: "",
  transmission: "",
  drive: "",
  type: "",
  title_status: "",
  paint_color: "",
  region: "",
  state: "",
};

const STEPS: { title: string; subtitle: string; fields: FieldName[] }[] = [
  {
    title: "Vehicle",
    subtitle: "Manufacturer, model, year, and odometer",
    fields: ["manufacturer", "model", "year", "odometer"],
  },
  {
    title: "Condition & Specs",
    subtitle: "Vehicle condition and technical specs",
    fields: ["condition", "cylinders", "fuel", "transmission", "drive", "type", "title_status", "paint_color"],
  },
  {
    title: "Location",
    subtitle: "Region and state",
    fields: ["region", "state"],
  },
];

const FIELD_LABELS: Record<FieldName, string> = {
  manufacturer: "Manufacturer",
  model: "Model",
  year: "Year",
  odometer: "Odometer (miles)",
  condition: "Condition",
  cylinders: "Cylinders",
  fuel: "Fuel",
  transmission: "Transmission",
  drive: "Drive",
  type: "Body Type",
  title_status: "Title Status",
  paint_color: "Paint Color",
  region: "Region",
  state: "State",
};

function currency(n: number): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function titleCase(s: string): string {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function mockFactors(form: FormState, price: number): Factor[] {
  const factors: Factor[] = [];
  const odometer = Number(form.odometer);
  const year = Number(form.year);
  const age = 2026 - year;

  if (odometer > 120000) factors.push({ label: "High odometer reading", impact: -Math.round((price * 0.1) / 10) * 10 });
  else if (odometer < 40000) factors.push({ label: "Low odometer reading", impact: Math.round((price * 0.08) / 10) * 10 });

  if (age > 12) factors.push({ label: "Older model year", impact: -Math.round((price * 0.09) / 10) * 10 });
  else if (age < 4) factors.push({ label: "Recent model year", impact: Math.round((price * 0.12) / 10) * 10 });

  if (["excellent", "like new", "new"].includes(form.condition)) {
    factors.push({ label: `${titleCase(form.condition)} condition`, impact: Math.round((price * 0.06) / 10) * 10 });
  } else if (["fair", "salvage"].includes(form.condition)) {
    factors.push({ label: `${titleCase(form.condition)} condition`, impact: -Math.round((price * 0.12) / 10) * 10 });
  }

  if (form.title_status && form.title_status !== "clean") {
    factors.push({ label: `Title status: ${form.title_status}`, impact: -Math.round((price * 0.15) / 10) * 10 });
  }

  if (factors.length === 0) factors.push({ label: "Typical specs for this segment", impact: 0 });
  return factors.slice(0, 4);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-negative">{message}</p>;
}

type SelectInputProps = {
  field: FieldName;
  value: string;
  options: string[];
  onChange: (field: FieldName, value: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
};

function SelectInput({ field, value, options, onChange, error, placeholder, disabled }: SelectInputProps) {
  return (
    <div className="flex flex-col">
      <label className="mb-1.5 text-sm font-semibold text-slate-700">{FIELD_LABELS[field]}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(field, e.target.value)}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition-all duration-200
          focus:ring-2 focus:ring-accent/40
          ${error ? "border-negative/60 focus:border-negative" : "border-slate-200 focus:border-accent"}
          disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
      >
        <option value="">{placeholder ?? `Select ${FIELD_LABELS[field].toLowerCase()}`}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {field === "year" ? opt : titleCase(opt)}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  );
}

type NumberInputProps = {
  field: FieldName;
  value: string;
  onChange: (field: FieldName, value: string) => void;
  error?: string;
  placeholder?: string;
  min?: number;
  max?: number;
};

function NumberInput({ field, value, onChange, error, placeholder, min, max }: NumberInputProps) {
  return (
    <div className="flex flex-col">
      <label className="mb-1.5 text-sm font-semibold text-slate-700">{FIELD_LABELS[field]}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(field, e.target.value)}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition-all duration-200
          focus:ring-2 focus:ring-accent/40
          ${error ? "border-negative/60 focus:border-negative" : "border-slate-200 focus:border-accent"}`}
      />
      <FieldError message={error} />
    </div>
  );
}

export default function CarPricePredictor() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [step, setStep] = useState<number>(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const modelOptions = useMemo<string[]>(
    () => (modelsByManufacturer as Record<string, string[]>)[form.manufacturer] ?? [],
    [form.manufacturer]
  );
  const sortedModelOptions = useMemo<string[]>(
    () => [...modelOptions].sort((a, b) => a.localeCompare(b)),
    [modelOptions]
  );

  function updateField(field: FieldName, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "manufacturer") next.model = "";
      return next;
    });
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validateStep(index: number): boolean {
    const stepErrors: FormErrors = {};
    for (const field of STEPS[index].fields) {
      const value = form[field];
      if (value === "" || value === null || value === undefined) {
        stepErrors[field] = "This field is required";
        continue;
      }
      if (field === "year") {
        const y = Number(value);
        if (!Number.isFinite(y) || y < 1900 || y > 2026) stepErrors[field] = "Enter a valid year";
      }
      if (field === "odometer") {
        const o = Number(value);
        if (!Number.isFinite(o) || o < 0) stepErrors[field] = "Enter a valid value";
      }
    }
    setErrors((prev) => ({ ...prev, ...stepErrors }));
    return Object.keys(stepErrors).length === 0;
  }

  function goNext() {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setApiError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateStep(step)) return;

    setLoading(true);
    setApiError(null);
    setResult(null);

    const payload = { ...form, year: Number(form.year), odometer: Number(form.odometer) };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "There was a problem connecting to the model. Please check your inputs.");
      }

      const data = await res.json();
      const price = data.estimated_price ?? data.predicted_price;
      const low = data.confidence_low ?? price * 0.92;
      const high = data.confidence_high ?? price * 1.08;
      const factors: Factor[] = data.factors && data.factors.length ? data.factors : mockFactors(form, price);
      const lowConfidence = Boolean(data.low_confidence);

      setResult({ price, low, high, factors, lowConfidence });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <main className="flex min-h-screen flex-col lg:flex-row bg-slate-50">
      
      {/* LEFT SIDE - VISUAL HERO (Dark Green Theme) */}
      <div className="relative flex flex-col justify-center bg-[#0d2e24] p-8 text-white lg:w-2/5 lg:p-16">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1614200187524-dc4b892acf16?q=80&w=1000&auto=format&fit=crop"
            alt="Luxury modern car"
            className="h-full w-full object-cover opacity-20 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d2e24] via-[#0d2e24]/80 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-md">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#6ee7b7] backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34d399] opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34d399]"></span>
            </span>
            Instant AI Valuation
          </div>
          <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            AI Car Price Estimator
          </h1>
          <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
            Get an accurate market value for your used vehicle in seconds. Our machine learning model analyzes thousands of data points to give you the best estimate.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE - INTERACTIVE APP */}
      <div className="flex flex-1 items-center justify-center p-4 py-12 lg:h-screen lg:overflow-y-auto lg:p-10">
        <div className="mx-auto w-full max-w-5xl">
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-5 xl:gap-10">
            
            {/* FORM SECTION */}
            <section className="xl:col-span-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50 sm:p-8">
                {/* Progress */}
                <div className="mb-8">
                  <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                    {STEPS.map((s, i) => (
                      <span key={s.title} className={i <= step ? "font-bold text-accent" : "font-medium"}>
                        {i + 1}. {s.title}
                      </span>
                    ))}
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-900">{STEPS[step].title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{STEPS[step].subtitle}</p>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {step === 0 && (
                      <>
                        <SelectInput
                          field="manufacturer"
                          value={form.manufacturer}
                          options={[...Object.keys(modelsByManufacturer)].sort((a, b) => a.localeCompare(b))}
                          onChange={updateField}
                          error={errors.manufacturer}
                        />
                        <SelectInput
                          field="model"
                          value={form.model}
                          options={sortedModelOptions}
                          onChange={updateField}
                          error={errors.model}
                          disabled={!form.manufacturer}
                          placeholder={form.manufacturer ? "Select model" : "Select manufacturer first"}
                        />
                        <NumberInput field="year" value={form.year} onChange={updateField} error={errors.year} min={1900} max={2026} placeholder="e.g. 2018" />
                        <NumberInput field="odometer" value={form.odometer} onChange={updateField} error={errors.odometer} min={0} placeholder="e.g. 65000" />
                      </>
                    )}

                    {step === 1 && (
                      <>
                        {(
                          [
                            "condition",
                            "cylinders",
                            "fuel",
                            "transmission",
                            "drive",
                            "type",
                            "title_status",
                            "paint_color",
                          ] as FieldName[]
                        ).map((field) => (
                          <SelectInput
                            key={field}
                            field={field}
                            value={form[field]}
                            options={[...(selectOptions as Record<string, string[]>)[field]].sort(
                              (a: string, b: string) => a.localeCompare(b)
                            )}
                            onChange={updateField}
                            error={errors[field]}
                          />
                        ))}
                      </>
                    )}

                    {step === 2 && (
                      <>
                        <SelectInput
                          field="region"
                          value={form.region}
                          options={[...selectOptions.region].sort((a: string, b: string) => a.localeCompare(b))}
                          onChange={updateField}
                          error={errors.region}
                        />
                        <SelectInput
                          field="state"
                          value={form.state}
                          options={[...selectOptions.state].sort((a: string, b: string) => a.localeCompare(b))}
                          onChange={updateField}
                          error={errors.state}
                        />
                      </>
                    )}
                  </div>

                  <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={step === 0}
                      className="w-full rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700
                                 transition-all hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                    >
                      Back
                    </button>

                    {step < STEPS.length - 1 ? (
                      <button
                        type="button"
                        onClick={goNext}
                        className="w-full rounded-xl bg-accent px-8 py-3 text-sm font-semibold text-white shadow-md shadow-accent/20 
                                   transition-all hover:bg-accent-dark active:scale-95 sm:w-auto"
                      >
                        Next Step
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-accent px-8 py-3 text-sm font-semibold text-white shadow-md shadow-accent/20 
                                   transition-all hover:bg-accent-dark active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Calculating...
                          </span>
                        ) : (
                          "Estimate Price"
                        )}
                      </button>
                    )}
                  </div>

                  {apiError && (
                    <div className="mt-5 rounded-xl border border-negative/20 bg-negative/5 px-5 py-4 text-sm text-negative">
                      {apiError}
                    </div>
                  )}
                </form>
              </div>
            </section>

            {/* RESULT SECTION */}
            <section className="xl:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50 sm:p-8 xl:sticky xl:top-10">
                <h2 className="mb-6 text-lg font-bold text-slate-900">Valuation Result</h2>

                {!result && !loading && (
                  <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 text-center">
                    <div className="mb-3 rounded-full bg-slate-100 p-3">
                      <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                      Complete the form and click "Estimate Price" to reveal your valuation.
                    </p>
                  </div>
                )}

                {loading && (
                  <div className="flex h-64 flex-col items-center justify-center rounded-xl bg-slate-50">
                    <svg className="mb-3 h-8 w-8 animate-spin text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm font-medium text-slate-500">Analyzing market data...</p>
                  </div>
                )}

                {result && !loading && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    {result.lowConfidence && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                        ⚠️ This vehicle combination is rare in our training data, so this estimate is less reliable than usual.
                      </div>
                    )}

                    <div className="rounded-xl bg-slate-50 p-5 text-center">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Estimated Price</p>
                      <p className="mt-2 text-4xl font-extrabold text-accent">{currency(result.price)}</p>
                      <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm border border-slate-100">
                        <span>Range:</span>
                        <span className="text-slate-900">{currency(result.low)} - {currency(result.high)}</span>
                      </div>
                    </div>

                    <div>
                      <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">Key Price Factors</p>
                      <ul className="space-y-3">
                        {result.factors.map((f, idx) => {
                          const positive = f.impact > 0;
                          const negative = f.impact < 0;
                          return (
                            <li key={`${f.label}-${idx}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                                  positive ? "bg-positive/10 text-positive" : negative ? "bg-negative/10 text-negative" : "bg-slate-100 text-slate-500"
                                }`}>
                                  {positive ? '↑' : negative ? '↓' : '-'}
                                </div>
                                <span className="truncate text-sm font-medium text-slate-700">{f.label}</span>
                              </div>
                              <span className={`shrink-0 text-sm font-bold ${
                                positive ? "text-positive" : negative ? "text-negative" : "text-slate-400"
                              }`}>
                                {f.impact === 0 ? "—" : `${positive ? "+" : ""}${currency(f.impact)}`}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <p className="border-t border-slate-100 pt-5 text-center text-[11px] leading-relaxed text-slate-400">
                      Estimate generated by an XGBoost model trained on real listing data. The range and factors
                      are illustrative approximations, not a guaranteed sale price.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

