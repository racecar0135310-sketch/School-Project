import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listSchools } from "../lib/storage.js";
import SiteHeader from "../components/SiteHeader.jsx";

export default function SchoolSelectPage() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    listSchools()
      .then(setSchools)
      .catch(() => setError("Couldn't reach the server. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader title="Daily homework diary" />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
       <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">School tools</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Choose your school</h1>
          <p className="mt-2 text-sm text-slate-500">Open the existing diary and paper generators for your school.</p>
        </div>

        {loading && <p className="text-sm text-slate-400 text-center">Loading schools…</p>}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && schools.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center text-sm text-slate-500">
            No schools have been set up yet. Ask whoever manages this site to add one from the
            dev portal.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {schools.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/school/${s.id}`)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
            >
              <p className="font-medium text-slate-800">{s.name}</p>
              {s.address && <p className="text-xs text-slate-500 mt-0.5">{s.address}</p>}
            </button>
          ))}
        </div>
       </div>
      </main>
    </div>
  );
}