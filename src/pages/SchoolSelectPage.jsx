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
      .catch(() => setError("Couldn't reach the server. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-slate-800">Daily Home Work Diary</h1>
          <p className="text-sm text-slate-500 mt-1">Choose your school to continue.</p>
        </div>

        {loading && <p className="text-sm text-slate-400 text-center">Loading schools…</p>}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2 mb-4">
            {error}
          </div>
        )}

        {!loading && !error && schools.length === 0 && (
          <p className="text-sm text-slate-400 text-center">
            No schools have been set up yet. Ask whoever manages this site to add one from the
            dev portal.
          </p>
        )}

        <div className="space-y-3">
          {schools.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/school/${s.id}`)}
              className="w-full bg-white rounded-lg shadow px-5 py-4 text-left hover:shadow-md hover:ring-2 hover:ring-emerald-600 transition"
            >
              <p className="font-medium text-slate-800">{s.name}</p>
              {s.address && <p className="text-xs text-slate-500 mt-0.5">{s.address}</p>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}