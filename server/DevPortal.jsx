import React, { useEffect, useState } from "react";
import {
  devLogin,
  devListSchools,
  devCreateSchool,
  devUpdateSchool,
  devDeleteSchool,
} from "../lib/storage.js";
import AccessGate from "../components/AccessGate.jsx";

const SESSION_KEY = "dev-access";
const emptyForm = {
  slug: "",
  name: "",
  address: "",
  phone: "",
  logoLeft: "",
  logoRight: "",
  generalCode: "",
  adminPassword: "",
};

export default function DevPortal() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === "true");
  const [devPassword, setDevPassword] = useState(() => sessionStorage.getItem(SESSION_KEY + "-pw") || "");

  if (!unlocked) {
    return (
      <AccessGate
        title="Developer Portal"
        subtitle="Manage every school from here."
        placeholder="Enter dev password"
        onVerify={async (password) => {
          const ok = await devLogin(password);
          if (ok) setDevPassword(password);
          return ok;
        }}
        onSuccess={() => {
          sessionStorage.setItem(SESSION_KEY, "true");
          sessionStorage.setItem(SESSION_KEY + "-pw", devPassword);
          setUnlocked(true);
        }}
      />
    );
  }

  return <DevEditor devPassword={devPassword} />;
}

function DevEditor({ devPassword }) {
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    try {
      setError("");
      setSchools(await devListSchools(devPassword));
    } catch (err) {
      setError("Couldn't load schools.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.slug.trim() || !form.name.trim() || !form.generalCode.trim() || !form.adminPassword.trim()) {
      setError("Slug, name, general code and admin password are all required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (editingId) {
        await devUpdateSchool(devPassword, editingId, form);
      } else {
        await devCreateSchool(devPassword, form);
      }
      await refresh();
      resetForm();
    } catch (err) {
      setError(err.message || "Couldn't save that school.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setForm({
      slug: s.slug,
      name: s.name,
      address: s.address || "",
      phone: s.phone || "",
      logoLeft: s.logoLeft || "",
      logoRight: s.logoRight || "",
      generalCode: s.generalCode,
      adminPassword: s.adminPassword,
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this school and ALL of its incharges? This can't be undone.")) return;
    setError("");
    try {
      await devDeleteSchool(devPassword, id);
      if (editingId === id) resetForm();
      await refresh();
    } catch (err) {
      setError("Couldn't delete that school.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white py-4 px-4 sm:px-6 shadow">
        <h1 className="text-base sm:text-lg font-semibold">Developer Portal</h1>
        <p className="text-xs sm:text-sm text-slate-300">
          Add, edit or remove schools. Each school's diary link is /&lt;slug&gt; and its
          admin link is /&lt;slug&gt;/admin.
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
              label="Slug (used in the URL)"
              value={form.slug}
              onChange={(v) => setForm((f) => ({ ...f, slug: v }))}
              placeholder="e.g. minhaj-girls"
            />
            <Field
              label="School name"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="e.g. Minhaj-ul-Quran Girls School"
            />
            <div className="col-span-2">
              <Field
                label="Address"
                value={form.address}
                onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                placeholder="e.g. Gulfishan Colony, Jhang Road, Faisalabad"
              />
            </div>
            <Field
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              placeholder="e.g. (041-265 1699-265 1290)"
            />
            <div />
            <Field
              label="Left logo URL (optional)"
              value={form.logoLeft}
              onChange={(v) => setForm((f) => ({ ...f, logoLeft: v }))}
              placeholder="https://…"
            />
            <Field
              label="Right logo URL (optional)"
              value={form.logoRight}
              onChange={(v) => setForm((f) => ({ ...f, logoRight: v }))}
              placeholder="https://…"
            />
            <Field
              label="Diary access code"
              value={form.generalCode}
              onChange={(v) => setForm((f) => ({ ...f, generalCode: v }))}
              placeholder="e.g. 135135"
            />
            <Field
              label="Admin password"
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
                    <p className="text-xs text-slate-500">
                      /{s.slug} · code {s.generalCode} · admin password {s.adminPassword}
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
