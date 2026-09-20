import React, { useEffect, useState } from "react";
import AccessGate from "../components/AccessGate.jsx";
import {
  devListSchools,
  devCreateSchool,
  devUpdateSchool,
  devDeleteSchool,
} from "../lib/storage.js";

const DEV_SESSION_KEY = "dev-access-password";
const emptyForm = { name: "", address: "", phone: "", diaryCode: "", adminPassword: "" };

export default function DevPortalPage() {
  // The dev password itself is kept only in sessionStorage on this device —
  // it's never hardcoded in the source. Every dev API call sends it fresh
  // and the server checks it against the DEV_PASSWORD environment variable.
  const [devPassword, setDevPassword] = useState(
    () => sessionStorage.getItem(DEV_SESSION_KEY) || ""
  );
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [revealedId, setRevealedId] = useState(null);

  const refresh = async (pwd) => {
    try {
      setError("");
      const list = await devListSchools(pwd);
      setSchools(list);
    } catch (err) {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (devPassword) refresh(devPassword);
  }, [devPassword]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.diaryCode.trim() || !form.adminPassword.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      if (editingId) {
        await devUpdateSchool(devPassword, editingId, form);
      } else {
        await devCreateSchool(devPassword, form);
      }
      await refresh(devPassword);
      resetForm();
    } catch (err) {
      setError("Couldn't save that — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      address: s.address || "",
      phone: s.phone || "",
      diaryCode: s.diaryCode,
      adminPassword: s.adminPassword,
    });
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Delete this school and all of its saved incharges? This can't be undone."
      )
    ) {
      return;
    }
    setError("");
    try {
      await devDeleteSchool(devPassword, id);
      if (editingId === id) resetForm();
      await refresh(devPassword);
    } catch (err) {
      setError("Couldn't delete that — please try again.");
    }
  };

  if (!devPassword) {
    return (
      <AccessGate
        title="Dev Portal"
        subtitle="Manage every school's diary code and admin password."
        onVerify={async (password) => {
          // devListSchools itself checks the password server-side (via the
          // x-dev-password header) — a successful response IS the proof
          // it's correct, so we reuse that call instead of a separate
          // verify endpoint.
          await devListSchools(password);
          return true;
        }}
        placeholder="Enter dev password"
        onSuccess={(password) => {
          sessionStorage.setItem(DEV_SESSION_KEY, password);
          setDevPassword(password);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white py-4 px-4 sm:px-6 shadow">
        <h1 className="text-base sm:text-lg font-semibold">Dev Portal — All Schools</h1>
        <p className="text-xs sm:text-sm text-slate-300">
          Add schools, and set or change each one's diary code and admin password.
        </p>
      </header>

      <main className="max-w-3xl mx-auto p-3 sm:p-4 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">
            {editingId ? "Edit school" : "Add a new school"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="School name"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="e.g. Minhaj-ul-Quran Girls School"
              full
            />
            <Field
              label="Address"
              value={form.address}
              onChange={(v) => setForm((f) => ({ ...f, address: v }))}
              placeholder="e.g. Gulfishan Colony, Jhang Road, Faisalabad"
              full
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              placeholder="e.g. (041-265 1699-265 1290)"
              full
            />
            <Field
              label="Diary access code"
              value={form.diaryCode}
              onChange={(v) => setForm((f) => ({ ...f, diaryCode: v }))}
              placeholder="e.g. 135135"
            />
            <Field
              label="Admin portal password"
              value={form.adminPassword}
              onChange={(v) => setForm((f) => ({ ...f, adminPassword: v }))}
              placeholder="e.g. Mutahhar@135"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-medium rounded-md px-4 py-2 text-sm"
            >
              {submitting ? "Saving…" : editingId ? "Save changes" : "Add school"}
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
          <h2 className="font-semibold text-slate-800 mb-3">Schools</h2>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : schools.length === 0 ? (
            <p className="text-sm text-slate-400">No schools yet — add one above.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {schools.map((s) => (
                <div key={s.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.address}</p>
                    <p className="text-xs text-slate-500">{s.phone}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {revealedId === s.id ? (
                        <>
                          Code: <span className="font-mono">{s.diaryCode}</span> · Admin
                          password: <span className="font-mono">{s.adminPassword}</span>
                        </>
                      ) : (
                        <button
                          onClick={() => setRevealedId(s.id)}
                          className="underline hover:text-slate-600"
                        >
                          Show code &amp; password
                        </button>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Diary link: {window.location.origin}/school/{s.id}
                    </p>
                  </div>
                  <div className="flex gap-3 text-sm shrink-0">
                    <button
                      onClick={() => handleEdit(s)}
                      className="text-emerald-700 hover:text-emerald-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
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

function Field({ label, value, onChange, placeholder, full }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
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