import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadTeachers, createTeacher, updateTeacher, deleteTeacher } from "../lib/storage.js";
import AccessGate from "../components/AccessGate.jsx";

const emptyForm = { inchargeName: "", className: "", section: "", subjectsText: "" };
const ADMIN_PASSWORD = "Mutahhar@135";
const ADMIN_SESSION_KEY = "admin-access-granted";

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(ADMIN_SESSION_KEY) === "true"
  );
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      setError("");
      const list = await loadTeachers();
      setTeachers(list);
    } catch (err) {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (unlocked) refresh();
  }, [unlocked]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.inchargeName.trim()) return;

    const subjects = form.subjectsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      inchargeName: form.inchargeName.trim(),
      className: form.className.trim(),
      section: form.section.trim(),
      subjects,
    };

    setSubmitting(true);
    setError("");
    try {
      if (editingId) {
        await updateTeacher(editingId, payload);
      } else {
        await createTeacher(payload);
      }
      await refresh();
      resetForm();
    } catch (err) {
      setError("Couldn't save that — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (t) => {
    setEditingId(t.id);
    setForm({
      inchargeName: t.inchargeName,
      className: t.className,
      section: t.section,
      subjectsText: t.subjects.join(", "),
    });
  };

  const handleDelete = async (id) => {
    setError("");
    try {
      await deleteTeacher(id);
      if (editingId === id) resetForm();
      await refresh();
    } catch (err) {
      setError("Couldn't delete that — please try again.");
    }
  };

  if (!unlocked) {
    return (
      <AccessGate
        title="Admin Portal"
        subtitle="Enter the admin password to continue."
        expected={ADMIN_PASSWORD}
        placeholder="Enter password"
        onSuccess={() => {
          sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
          setUnlocked(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-emerald-800 text-white py-4 px-4 sm:px-6 shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-semibold">Admin — Class Incharges</h1>
          <p className="text-xs sm:text-sm text-emerald-100">
            Add each teacher once with their class, section and subjects. The
            diary page will auto-fill this when the teacher types their name.
          </p>
        </div>
        <Link
          to="/"
          className="self-start sm:self-auto bg-white/10 hover:bg-white/20 text-sm font-medium px-3 py-1.5 rounded"
        >
          ← Back to diary
        </Link>
      </header>

      <main className="max-w-3xl mx-auto p-3 sm:p-4 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">
            {editingId ? "Edit incharge" : "Add a new incharge"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Incharge name"
              value={form.inchargeName}
              onChange={(v) => setForm((f) => ({ ...f, inchargeName: v }))}
              placeholder="e.g. Afaq Ahmad"
            />
            <Field
              label="Class"
              value={form.className}
              onChange={(v) => setForm((f) => ({ ...f, className: v }))}
              placeholder="e.g. 7th"
            />
            <Field
              label="Section"
              value={form.section}
              onChange={(v) => setForm((f) => ({ ...f, section: v }))}
              placeholder="e.g. Jaami"
            />
            <div>
              <span className="text-xs font-medium text-slate-500">Subjects</span>
              <input
                className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                value={form.subjectsText}
                placeholder="English, Urdu, Math, Computer Science"
                onChange={(e) => setForm((f) => ({ ...f, subjectsText: e.target.value }))}
              />
              <span className="text-[11px] text-slate-400">Comma-separated</span>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-medium rounded-md px-4 py-2 text-sm"
            >
              {submitting ? "Saving…" : editingId ? "Save changes" : "Add incharge"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Saved incharges</h2>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : teachers.length === 0 ? (
            <p className="text-sm text-slate-400">No incharges added yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {teachers.map((t) => (
                <div key={t.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{t.inchargeName}</p>
                    <p className="text-xs text-slate-500">
                      Class {t.className} · {t.section}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.subjects.length ? t.subjects.join(", ") : "No subjects listed"}
                    </p>
                  </div>
                  <div className="flex gap-3 text-sm shrink-0">
                    <button
                      onClick={() => handleEdit(t)}
                      className="text-emerald-700 hover:text-emerald-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input
        className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}