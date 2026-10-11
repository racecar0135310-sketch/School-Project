import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { clearSession, getSession, ROLE_META } from "../lib/auth.js";

export const NAV_BY_ROLE = {
  admin: [
    ["overview", "Overview", "⌂"],
    ["teachers", "Teachers", "♙"],
    ["students", "Students", "♧"],
    ["settings", "School settings", "⚙"],
  ],
  teacher: [
    ["overview", "Overview", "⌂"],
    ["attendance", "Attendance", "✓"],
    ["gradebook", "Gradebook", "▤"],
    ["homework", "Homework", "⌁"],
    ["materials", "Study material", "▣"],
    ["generators", "Generators", "✦"],
  ],
  student: [
    ["overview", "My dashboard", "⌂"],
    ["diary", "Diary & homework", "⌁"],
    ["tests", "Tests", "▣"],
    ["results", "Results", "▤"],
  ],
};

const ACCENTS = {
  admin: { dot: "bg-blue-500", active: "bg-blue-50 text-blue-700", button: "bg-blue-600 hover:bg-blue-700", soft: "bg-blue-50", ring: "focus:ring-blue-500" },
  teacher: { dot: "bg-emerald-500", active: "bg-emerald-50 text-emerald-700", button: "bg-emerald-600 hover:bg-emerald-700", soft: "bg-emerald-50", ring: "focus:ring-emerald-500" },
  student: { dot: "bg-orange-500", active: "bg-orange-50 text-orange-700", button: "bg-orange-500 hover:bg-orange-600", soft: "bg-orange-50", ring: "focus:ring-orange-500" },
};

export function useDashboardNavigation(role) {
  const [params, setParams] = useSearchParams();
  const nav = NAV_BY_ROLE[role] || NAV_BY_ROLE.student;
  const requested = params.get("view");
  const activeView = nav.some(([id]) => id === requested) ? requested : nav[0][0];
  const goTo = (view) => setParams({ view }, { replace: true });
  return { nav, activeView, goTo };
}

export default function AppShell({ session = getSession(), activeView, onNavigate, children }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const role = session?.user?.role || "student";
  const meta = ROLE_META[role] || ROLE_META.student;
  const accent = ACCENTS[role] || ACCENTS.student;
  const nav = NAV_BY_ROLE[role] || NAV_BY_ROLE.student;

  useEffect(() => setMenuOpen(false), [activeView]);

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {menuOpen && <button aria-label="Close menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" />}
      <aside className={`fixed z-40 inset-y-0 left-0 w-[18.5rem] bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-20 px-6 flex items-center border-b border-slate-100"><Link to="/app" className="flex items-center gap-3"><span className={`w-10 h-10 rounded-2xl ${accent.soft} grid place-items-center font-black ${role === "admin" ? "text-blue-700" : role === "teacher" ? "text-emerald-700" : "text-orange-600"}`}>S</span><div><p className="font-black tracking-tight text-slate-900">SchoolFlow</p><p className="text-[10px] text-slate-400">{meta.label} workspace</p></div></Link><button className="ml-auto lg:hidden text-slate-400" onClick={() => setMenuOpen(false)}>✕</button></div>
        <div className="p-4"><div className={`rounded-2xl ${accent.soft} px-4 py-3`}><p className="text-[10px] uppercase tracking-widest text-slate-400">Signed in as</p><p className="mt-1 font-bold text-sm truncate">{session?.user?.name}</p><p className="mt-0.5 text-xs text-slate-500 capitalize">{meta.label}</p></div></div>
        <nav className="px-3 space-y-1 flex-1" aria-label="Main navigation">{nav.map(([id, label, icon]) => <button key={id} onClick={() => onNavigate(id)} className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-left transition ${activeView === id ? accent.active : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><span className={`w-7 h-7 rounded-lg grid place-items-center text-base ${activeView === id ? "bg-white/70" : "bg-slate-100 text-slate-500"}`}>{icon}</span>{label}{activeView === id && <span className="ml-auto">›</span>}</button>)}</nav>
        <div className="p-4 border-t border-slate-100 space-y-1"><button onClick={() => onNavigate(role === "admin" ? "settings" : "overview")} className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50">⚙ <span>{role === "admin" ? "School settings" : "My profile"}</span></button><button onClick={() => window.alert("You are all caught up.")} className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50">♢ <span>Notifications</span></button><Link to="/" className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50">↗ <span>SchoolFlow home</span></Link><button onClick={logout} className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600">⇥ <span>Sign out</span></button></div>
      </aside>

      <div className="lg:pl-[18.5rem] min-h-screen">
        <header className="sticky top-0 z-20 h-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4"><div className="flex items-center gap-3 min-w-0"><button aria-label="Open menu" onClick={() => setMenuOpen(true)} className="lg:hidden w-10 h-10 rounded-xl border border-slate-200 text-slate-600 grid place-items-center text-xl">☰</button><div className="min-w-0"><p className="text-xs font-semibold text-slate-400">{meta.label} dashboard</p><h1 className="text-lg sm:text-xl font-black tracking-tight truncate">{nav.find(([id]) => id === activeView)?.[1] || meta.label}</h1></div></div><div className="flex items-center gap-2 sm:gap-3"><button className="w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 grid place-items-center relative" aria-label="Notifications">♢<span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${accent.dot}`} /></button><div className="relative"><button onClick={() => setProfileOpen((value) => !value)} className="flex items-center gap-2 rounded-xl border border-slate-200 p-1.5 pr-2.5 hover:bg-slate-50"><span className={`w-8 h-8 rounded-lg ${accent.soft} grid place-items-center font-bold text-sm ${role === "admin" ? "text-blue-700" : role === "teacher" ? "text-emerald-700" : "text-orange-600"}`}>{(session?.user?.name || "U").slice(0, 1).toUpperCase()}</span><span className="hidden sm:block max-w-28 truncate text-xs font-bold text-slate-700">{session?.user?.name}</span><span className="text-slate-400 text-xs">⌄</span></button>{profileOpen && <div className="absolute right-0 top-14 w-48 rounded-2xl border border-slate-200 bg-white shadow-xl p-2"><p className="px-3 py-2 text-[10px] uppercase tracking-widest text-slate-400">{session?.user?.userId}</p><button onClick={logout} className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50">Sign out</button></div>}</div></div></header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1440px]">{children}</main>
      </div>
    </div>
  );
}

export { ACCENTS };
