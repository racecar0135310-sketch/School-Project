import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listSchools } from "../lib/storage.js";

export default function SchoolSelectPage() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    listSchools()
      .then(setSchools)
      .catch(() => setError("Couldn't load the school list. Check your connection."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-semibold text-slate-800 text-center mb-1">
          Daily Home Work Diary
        </h1>
        <p className="text-sm text-slate-500 text-center mb-6">Select your school to continue</p>

        {loading && <p className="text-sm text-slate-400 text-center">Loading schools…</p>}
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        {!loading && !error && schools.length === 0 && (
          <p className="text-sm text-slate-400 text-center">
            No schools have been set up yet.
          </p>
        )}

        <div className="space-y-3">
          {schools.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/${s.slug}`)}
              className="w-full bg-white rounded-lg shadow px-5 py-4 text-left hover:shadow-md transition-shadow flex items-center gap-3"
            >
              {s.logoLeft ? (
                <img src={s.logoLeft} alt="" className="w-10 h-10 object-contain shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-100 shrink-0" />
              )}
              <div>
                <p className="font-medium text-slate-800">{s.name}</p>
                {s.address && <p className="text-xs text-slate-500">{s.address}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
