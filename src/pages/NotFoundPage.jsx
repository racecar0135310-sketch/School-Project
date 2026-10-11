import React from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader.jsx";

export default function NotFoundPage() {
  return <div className="min-h-screen bg-slate-50">
    <SiteHeader title="Page not found" />
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-5 text-center">
      <p className="text-sm font-bold uppercase tracking-[.2em] text-blue-600">Error 404</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">We can’t find that page.</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">The address may be incorrect, or the page may have moved.</p>
      <Link to="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-700">Back to SchoolFlow</Link>
    </main>
  </div>;
}
