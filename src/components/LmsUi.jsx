import React from "react";

export function PageIntro({ eyebrow, title, description, action }) {
  return <div className="mb-7 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">{eyebrow}</p><h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">{title}</h2>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}</div>{action}</div>;
}

export function StatCard({ label, value, detail, icon, tone = "blue" }) {
  const tones = { blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", orange: "bg-orange-50 text-orange-700", violet: "bg-violet-50 text-violet-700" };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-400">{label}</p><p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p></div><span className={`w-10 h-10 rounded-xl grid place-items-center text-lg font-bold ${tones[tone] || tones.blue}`}>{icon}</span></div>{detail && <p className="mt-3 text-xs text-slate-400">{detail}</p>}</div>;
}

export function Panel({ title, description, action, children, className = "" }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}><div className="px-5 sm:px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"><div><h3 className="font-bold text-slate-900">{title}</h3>{description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}</div>{action}</div><div className="p-5 sm:p-6">{children}</div></section>;
}

export function Field({ label, value, onChange, placeholder, type = "text", required = false, className = "", min }) {
  return <label className={`block ${className}`}><span className="text-xs font-semibold text-slate-500">{label}</span><input required={required} type={type} min={min} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label>;
}

export function TextArea({ label, value, onChange, placeholder, rows = 3, className = "" }) {
  return <label className={`block ${className}`}><span className="text-xs font-semibold text-slate-500">{label}</span><textarea rows={rows} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label>;
}

export function SelectField({ label, value, onChange, options, placeholder, className = "" }) {
  return <label className={`block ${className}`}><span className="text-xs font-semibold text-slate-500">{label}</span><select value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"><option value="">{placeholder || `Select ${label.toLowerCase()}`}</option>{options.map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}</select></label>;
}

export function PrimaryButton({ children, type = "button", onClick, disabled = false, tone = "blue", className = "" }) {
  const tones = { blue: "bg-blue-600 hover:bg-blue-700", green: "bg-emerald-600 hover:bg-emerald-700", orange: "bg-orange-500 hover:bg-orange-600", slate: "bg-slate-800 hover:bg-slate-900" };
  return <button type={type} onClick={onClick} disabled={disabled} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone] || tones.blue} ${className}`}>{children}</button>;
}

export function SecondaryButton({ children, type = "button", onClick, className = "" }) { return <button type={type} onClick={onClick} className={`rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 ${className}`}>{children}</button>; }

export function Notice({ children, type = "error" }) { const style = type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"; return <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${style}`}>{children}</div>; }

export function EmptyState({ icon = "⌁", title, text }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center"><div className="mx-auto w-11 h-11 rounded-2xl bg-white border border-slate-200 grid place-items-center text-xl text-slate-400">{icon}</div><p className="mt-3 text-sm font-bold text-slate-700">{title}</p>{text && <p className="mt-1 text-xs text-slate-400">{text}</p>}</div>; }

export function StatusPill({ children, tone = "slate" }) { const styles = { green: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700", orange: "bg-orange-50 text-orange-700", blue: "bg-blue-50 text-blue-700", slate: "bg-slate-100 text-slate-600" }; return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[tone] || styles.slate}`}>{children}</span>; }

export function LoadingState() { return <div className="py-16 text-center text-sm text-slate-400"><span className="inline-block animate-spin text-xl">◌</span><p className="mt-2">Loading your workspace…</p></div>; }