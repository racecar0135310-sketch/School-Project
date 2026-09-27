import React from "react";

// A native <input type="color"> already gives a full RGB/HSV picker (with a
// hex field) in every modern browser, so that's all this needs — plus the
// hex value shown alongside it for anyone who wants to type an exact code.
export default function ColorField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="mt-1 flex items-center gap-2 border border-slate-300 rounded px-1.5 py-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 shrink-0 border-0 bg-transparent p-0 cursor-pointer"
          title={`Pick a ${label.toLowerCase()} color`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 text-xs font-mono text-slate-600 focus:outline-none"
          spellCheck={false}
        />
      </div>
    </label>
  );
}
