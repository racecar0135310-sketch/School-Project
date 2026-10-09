import React, { useState } from "react";
import SiteHeader from "./SiteHeader.jsx";

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
    <div className="min-h-screen bg-slate-50">
      <SiteHeader title="Secure access" />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center p-4">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-xl text-blue-700">⌑</span>
            <h1 className="mt-4 text-xl font-black tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>}
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
            className={`w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm text-center tracking-widest outline-none focus:ring-2 ${
              error
                ? "border-red-400 focus:ring-red-200"
                : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
            }`}
          />
          {error && <p className="text-center text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={checking} className="w-full rounded-xl bg-blue-700 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-60">
            {checking ? "Checking…" : "Continue"}
          </button>
        </form>
      </main>
    </div>
  );
}