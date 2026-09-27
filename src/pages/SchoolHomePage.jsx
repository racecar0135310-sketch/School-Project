import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSchool, verifyDiaryCode } from "../lib/storage.js";
import AccessGate from "../components/AccessGate.jsx";
import DiaryGenerator from "../components/DiaryGenerator.jsx";
import TestPaperGenerator from "../components/TestPaperGenerator.jsx";

// This replaces the old DiaryPage as the /school/:schoolId route. The access
// code is checked once here (same code as before — nothing changes for
// teachers who already have it), and only after that does the teacher pick
// what to generate. Picking a mode never asks for the code again.
export default function SchoolHomePage() {
  const { schoolId } = useParams();
  const sessionKey = `diary-access-granted-${schoolId}`;

  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(sessionKey) === "true");
  const [school, setSchool] = useState(null);
  const [schoolError, setSchoolError] = useState(false);
  const [mode, setMode] = useState(null); // null | "diary" | "testpaper"

  useEffect(() => {
    let cancelled = false;
    getSchool(schoolId)
      .then((s) => {
        if (!cancelled) setSchool(s);
      })
      .catch(() => {
        if (!cancelled) setSchoolError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  if (schoolError) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow p-6 max-w-sm text-center space-y-3">
          <h1 className="font-semibold text-slate-800">School not found</h1>
          <p className="text-sm text-slate-500">
            This link doesn't match a school we know about. Please check the link or pick your school again.
          </p>
          <Link to="/" className="text-emerald-700 text-sm font-medium hover:text-emerald-900">
            ← Choose a school
          </Link>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <AccessGate
        title={school ? school.name : "Daily Home Work Diary"}
        subtitle="Enter the access code to continue."
        onVerify={(code) => verifyDiaryCode(schoolId, code)}
        placeholder="Enter code"
        onSuccess={() => {
          sessionStorage.setItem(sessionKey, "true");
          setUnlocked(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-emerald-800 text-white py-4 px-4 sm:px-6 shadow flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-semibold">
            {mode === "testpaper" ? "Test Paper — Generator" : mode === "diary" ? "Daily Home Work Diary — Generator" : school?.name || "Generator"}
          </h1>
          {mode && (
            <p className="text-xs sm:text-sm text-emerald-100">
              {mode === "testpaper"
                ? "Fill in the paper details, add each part's questions, then download the Word file."
                : "Type your name in Incharge to auto-fill your class, then add each subject's homework."}
            </p>
          )}
        </div>
        {mode && (
          <button
            onClick={() => setMode(null)}
            className="self-start bg-white/10 hover:bg-white/20 text-sm font-medium px-3 py-1.5 rounded whitespace-nowrap"
          >
            ← Switch
          </button>
        )}
      </header>

      {!mode ? (
        <main className="max-w-xl mx-auto p-4 sm:p-6">
          <p className="text-sm text-slate-500 text-center mb-5">What would you like to create today?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ModeCard
              title="Daily Home Work Diary"
              desc="Fill each subject's homework and save it as a shareable image."
              onClick={() => setMode("diary")}
            />
            <ModeCard
              title="Test Paper"
              desc="Build an MCQs + subjective test paper and download it as a Word document."
              onClick={() => setMode("testpaper")}
            />
          </div>
        </main>
      ) : mode === "diary" ? (
        <DiaryGenerator school={school} schoolId={schoolId} />
      ) : (
        <main className="max-w-6xl mx-auto p-3 sm:p-4">
          <TestPaperGenerator school={school} />
        </main>
      )}
    </div>
  );
}

function ModeCard({ title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg shadow px-5 py-6 text-left hover:shadow-md hover:ring-2 hover:ring-emerald-600 transition"
    >
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </button>
  );
}