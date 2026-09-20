import React, { useState } from "react";

// A simple lock screen: the child page is only rendered after the visitor
// enters the expected code/password. Pass either:
//   - expected: a plain string to compare against locally, or
//   - onVerify: an async (value) => boolean function (e.g. checking against
//     the server), for codes that live in the database instead of source code.
export default function AccessGate({
  title,
  subtitle,
  expected,
  onVerify,
  placeholder = "Enter password",
  onSuccess,
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setChecking(true);
    try {
      const ok = onVerify ? await onVerify(value) : value === expected;
      if (ok) {
        onSuccess(value);
      } else {
        setError("That's not correct — please try again.");
      }
    } catch (err) {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setChecking(false);
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
            setError("");
          }}
          placeholder={placeholder}
          className={`w-full border rounded px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 ${
            error
              ? "border-red-400 focus:ring-red-400"
              : "border-slate-300 focus:ring-emerald-600"
          }`}
        />
        {error && <p className="text-xs text-red-600 text-center">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-medium rounded-md py-2 text-sm"
        >
          {checking ? "Checking…" : "Continue"}
        </button>
      </form>
    </div>
  );
}