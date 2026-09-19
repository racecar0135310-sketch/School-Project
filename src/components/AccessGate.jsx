import React, { useState } from "react";

// A simple lock screen: the child page is only rendered after the visitor
// enters the expected code/password. This is client-side only (there's no
// backend), so it's meant to keep casual/unintended visitors out — such as
// students landing on the admin page — not to protect sensitive data.
export default function AccessGate({
  title,
  subtitle,
  expected,
  placeholder = "Enter password",
  onSuccess,
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value === expected) {
      setError(false);
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow p-6 w-full max-w-sm space-y-4"
      >
        <div className="text-center">
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          placeholder={placeholder}
          className={`w-full border rounded px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 ${
            error
              ? "border-red-400 focus:ring-red-400"
              : "border-slate-300 focus:ring-emerald-600"
          }`}
        />
        {error && (
          <p className="text-xs text-red-600 text-center">
            That's not correct — please try again.
          </p>
        )}
        <button
          type="submit"
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-md py-2 text-sm"
        >
          Continue
        </button>
      </form>
    </div>
  );
}