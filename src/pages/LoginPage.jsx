import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "../lib/storage.js";
import { getSession, saveSession, ROLE_META } from "../lib/auth.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) navigate("/app", { replace: true });
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!userId.trim() || !password) {
      setError("Enter your ID and password to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const session = await login(userId.trim(), password);
      saveSession(session);
      const destination = location.state?.from || "/app";
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || "We couldn't sign you in. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-stretch">
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden p-10 xl:p-16 flex-col justify-between bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-950">
        <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative"><Link to="/" className="flex items-center gap-3"><span className="w-10 h-10 rounded-2xl bg-cyan-300 text-slate-950 grid place-items-center font-black">S</span><span className="font-bold text-lg">SchoolFlow</span></Link><div className="mt-28 max-w-md"><p className="text-cyan-200 text-sm font-semibold uppercase tracking-[.2em]">Welcome back</p><h1 className="mt-4 text-5xl font-black leading-tight tracking-tight">Your school day starts here.</h1><p className="mt-5 text-blue-100/75 leading-7">Sign in once. We will detect your role and take you straight to the right dashboard.</p></div></div>
        <div className="relative flex flex-wrap gap-2 text-xs text-blue-100/70"><span className="rounded-full border border-white/15 px-3 py-1.5">Secure role-based access</span><span className="rounded-full border border-white/15 px-3 py-1.5">Works on every device</span></div>
      </div>

      <div className="w-full lg:w-[54%] flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-between mb-14"><Link to="/" className="flex items-center gap-3"><span className="w-9 h-9 rounded-xl bg-cyan-300 text-slate-950 grid place-items-center font-black">S</span><span className="font-bold">SchoolFlow</span></Link><Link to="/" className="text-xs text-slate-400 hover:text-white">Home</Link></div>
          <div className="mb-8"><p className="text-sm text-cyan-300 font-semibold">Secure sign in</p><h2 className="mt-2 text-3xl font-black tracking-tight">Access your workspace</h2><p className="mt-2 text-sm text-slate-400">Use the ID provided by your school administrator.</p></div>
          {error && <div role="alert" className="mb-5 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block"><span className="text-xs font-semibold text-slate-300">User ID</span><input autoFocus value={userId} onChange={(e) => { setUserId(e.target.value); setError(""); }} placeholder="e.g. ayesha-khan" autoComplete="username" className="mt-2 w-full rounded-xl border border-white/15 bg-white/[.07] px-4 py-3.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20" /></label>
            <label className="block"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-300">Password</span><span className="text-[11px] text-slate-500">Shared by your school role</span></div><div className="relative mt-2"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="Enter your password" autoComplete="current-password" className="w-full rounded-xl border border-white/15 bg-white/[.07] px-4 py-3.5 pr-20 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-cyan-300 hover:text-cyan-100">{showPassword ? "Hide" : "Show"}</button></div></label>
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-cyan-300 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-200 disabled:opacity-60 transition">{loading ? "Checking your account…" : "Sign in"}</button>
          </form>
          <div className="mt-8 border-t border-white/10 pt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><div className="flex gap-4"><Link to="/" className="hover:text-white">← Home</Link><Link to="/schools" className="hover:text-white">School diary</Link></div><span>Role is detected automatically</span></div>
          <div className="mt-10 grid grid-cols-3 gap-2">{Object.entries(ROLE_META).map(([role, meta]) => <div key={role} className="rounded-xl border border-white/10 bg-white/[.04] p-3"><span className={`inline-block w-2 h-2 rounded-full ${role === "admin" ? "bg-blue-400" : role === "teacher" ? "bg-emerald-400" : "bg-orange-400"}`} /><p className="mt-2 text-xs font-semibold text-slate-300">{meta.label}</p></div>)}</div>
        </div>
      </div>
    </div>
  );
}