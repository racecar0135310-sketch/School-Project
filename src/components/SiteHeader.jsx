import React from "react";
import { Link } from "react-router-dom";

export default function SiteHeader({ dark = false, title }) {
  return (
    <header className={`relative z-20 border-b ${dark ? "border-white/10 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="SchoolFlow home">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-600 font-black text-slate-950 shadow-lg shadow-cyan-500/15">S</span>
          <span className="min-w-0">
            <span className="block font-black tracking-tight">SchoolFlow</span>
            {title && <span className={`block truncate text-[10px] ${dark ? "text-slate-400" : "text-slate-500"}`}>{title}</span>}
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2" aria-label="Website navigation">
          <Link to="/" className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${dark ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>Home</Link>
          <Link to="/schools" className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${dark ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>School diary</Link>
          <Link to="/login" className={`rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${dark ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200" : "bg-slate-950 text-white hover:bg-blue-950"}`}>Sign in</Link>
        </nav>
      </div>
    </header>
  );
}
