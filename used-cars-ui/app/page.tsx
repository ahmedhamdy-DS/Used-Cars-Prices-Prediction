// app/page.tsx
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

// Fields split across 3 steps
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

// Same "influencing factors" heuristic as main.py — used as a client-side
// fallback if the server doesn't return `factors`, so the result card stays
// useful either way.
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
  return <p className="mt-1 text-xs text-negative">{message}</p>;
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
      <label className="mb-1.5 text-sm font-medium text-stone-700">{FIELD_LABELS[field]}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(field, e.target.value)}
        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition
          focus:ring-2 focus:ring-accent/30
          ${error ? "border-negative/60 focus:border-negative" : "border-stone-300 focus:border-accent"}
          disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400`}
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
      <label className="mb-1.5 text-sm font-medium text-stone-700">{FIELD_LABELS[field]}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(field, e.target.value)}
        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition
          focus:ring-2 focus:ring-accent/30
          ${error ? "border-negative/60 focus:border-negative" : "border-stone-300 focus:border-accent"}`}
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
    <main className="min-h-screen bg-stone-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 text-center sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Instant AI-Powered Valuation</p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900 sm:text-3xl">AI Car Price Estimator</h1>
          <p className="mt-1 text-sm text-stone-500">Estimate your used car&apos;s value in under a minute</p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
          {/* FORM */}
          <section className="lg:col-span-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              {/* Progress */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-xs text-stone-500">
                  {STEPS.map((s, i) => (
                    <span key={s.title} className={i <= step ? "font-semibold text-accent" : ""}>
                      {i + 1}. {s.title}
                    </span>
                  ))}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              <h2 className="mb-1 text-base font-semibold text-stone-900">{STEPS[step].title}</h2>
              <p className="mb-5 text-xs text-stone-500">{STEPS[step].subtitle}</p>

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={step === 0}
                    className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700
                               transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                  >
                    Back
                  </button>

                  {step < STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      className="w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-dark sm:w-auto"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition
                                 hover:bg-accent-dark disabled:cursor-not-allowed disabled:bg-stone-300 sm:w-auto"
                    >
                      {loading ? "Calculating..." : "Estimate Price"}
                    </button>
                  )}
                </div>

                {apiError && (
                  <div className="mt-4 rounded-lg border border-negative/20 bg-negative/5 px-4 py-3 text-sm text-negative">
                    {apiError}
                  </div>
                )}
              </form>
            </div>
          </section>

          {/* RESULT */}
          <section className="lg:col-span-2">
            <div className="lg:sticky lg:top-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="mb-5 text-sm font-semibold text-stone-900">Valuation Result</h2>

              {!result && !loading && (
                <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 px-4 text-center">
                  <p className="text-sm text-stone-400">
                    Complete the form and click &quot;Estimate Price&quot; to see your valuation here
                  </p>
                </div>
              )}

              {loading && (
                <div className="flex h-56 items-center justify-center">
                  <p className="text-sm text-stone-400">Calculating...</p>
                </div>
              )}

              {result && !loading && (
                <div className="space-y-6">
                  {result.lowConfidence && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      This vehicle combination is rare in our training data, so this estimate is less reliable than usual.
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-400">Estimated Price</p>
                    <p className="mt-1 text-4xl font-extrabold text-positive">{currency(result.price)}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      Estimated range: {currency(result.low)} &ndash; {currency(result.high)}
                    </p>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-medium uppercase tracking-wider text-stone-400">Factors influencing this price</p>
                    <ul className="space-y-2.5">
                      {result.factors.map((f) => {
                        const positive = f.impact > 0;
                        const negative = f.impact < 0;
                        return (
                          <li key={f.label} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  positive ? "bg-positive" : negative ? "bg-negative" : "bg-stone-300"
                                }`}
                              />
                              <span className="truncate text-xs text-stone-600">{f.label}</span>
                            </div>
                            <span
                              className={`shrink-0 text-xs font-semibold ${
                                positive ? "text-positive" : negative ? "text-negative" : "text-stone-400"
                              }`}
                            >
                              {f.impact === 0 ? "—" : `${positive ? "+" : ""}${currency(f.impact)}`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <p className="border-t border-stone-100 pt-4 text-[11px] leading-relaxed text-stone-400">
                    Estimate generated by an XGBoost model trained on real listing data. The range and factors
                    are illustrative approximations, not a guaranteed sale price.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

