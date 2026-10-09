import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AccessGate from "../components/AccessGate.jsx";
import SiteHeader from "../components/SiteHeader.jsx";
import {
  devListSchools,
  devCreateSchool,
  devUpdateSchool,
  devDeleteSchool,
} from "../lib/storage.js";

const DEV_SESSION_KEY = "dev-access-password";
const emptyForm = {
  name: "",
  address: "",
  phone: "",
  diaryCode: "",
  adminUserId: "",
  adminPassword: "",
  leftLogo: "",
  rightLogo: "",
};

// Reads a chosen image file into a base64 data URI, so it can be sent to
// the server as plain JSON and stored straight on the School document — no
// separate file upload endpoint or storage bucket needed. Any image format
// the browser can decode (PNG, JPG, SVG, WEBP, etc.) works, and whatever
// width/height ratio it comes in is fine — the diary always fits it into a
// fixed box on its own, without stretching it.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

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
  const [logoError, setLogoError] = useState("");

  const refresh = async (pwd) => {
    try {
      setError("");
      const list = await devListSchools(pwd);
      setSchools(list);
    } catch (err) {
      setError(err.message || "Couldn't reach the server. Check your connection and try again.");
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
    setLogoError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.diaryCode.trim() || !form.adminUserId.trim() || (!editingId && !form.adminPassword.trim())) return;

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
      // Show the server's actual reason (e.g. "That diaryCode is already
      // used by another school") instead of a generic message, so a
      // conflict or validation problem is obvious instead of a dead end.
      setError(err.message || "Couldn't save that — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setLogoError("");
    setForm({
      name: s.name,
      address: s.address || "",
      phone: s.phone || "",
      diaryCode: s.diaryCode,
      adminUserId: s.adminUserId || "",
      adminPassword: "",
      leftLogo: s.leftLogo || "",
      rightLogo: s.rightLogo || "",
    });
  };

  const handleLogoUpload = async (key, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Please choose an image file for the logo.");
      return;
    }
    // 2MB keeps the request body (and the DB document) comfortably small —
    // logos don't need to be any bigger than that to look sharp at the size
    // they're shown on the diary.
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("That logo is too large — please use an image under 2MB.");
      return;
    }
    setLogoError("");
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((f) => ({ ...f, [key]: dataUrl }));
    } catch (err) {
      setLogoError("Couldn't read that file — please try another image.");
    }
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
      setError(err.message || "Couldn't delete that — please try again.");
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
    <div className="min-h-screen bg-slate-50">
      <SiteHeader dark title="System setup" />
      <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 text-white px-4 py-7 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Developer workspace</p>
          <h1 className="mt-2 text-2xl font-black">Manage schools</h1>
          <p className="mt-1 text-sm text-slate-300">Create each school's diary access and its administrator's SchoolFlow login.</p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm space-y-5">
          <h2 className="font-bold text-slate-900 text-lg">
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
              label="Admin login ID"
              value={form.adminUserId}
              onChange={(v) => setForm((f) => ({ ...f, adminUserId: v }))}
              placeholder="e.g. green-valley-admin"
              required
            />
            <Field
              label={editingId ? "Reset admin login password (optional)" : "Admin login password"}
              value={form.adminPassword}
              onChange={(v) => setForm((f) => ({ ...f, adminPassword: v }))}
              placeholder={editingId ? "Leave blank to keep the current password" : "Create a secure password"}
              required={!editingId}
            />
          </div>
          <p className="text-xs text-slate-500">The admin uses this ID and password at <a href="/login" className="font-semibold text-blue-700 hover:underline">Sign in</a>. The same password also remains valid for the legacy school admin page.</p>

          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Diary logos</p>
            <p className="text-[11px] text-slate-400 mb-2">
              Upload the left and right logos shown on the diary header. Any image
              format and any width/height ratio works — the diary fits each one
              into its logo space automatically without stretching it.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <LogoField
                label="Left logo"
                value={form.leftLogo}
                onUpload={(file) => handleLogoUpload("leftLogo", file)}
                onRemove={() => setForm((f) => ({ ...f, leftLogo: "" }))}
              />
              <LogoField
                label="Right logo"
                value={form.rightLogo}
                onUpload={(file) => handleLogoUpload("rightLogo", file)}
                onRemove={() => setForm((f) => ({ ...f, rightLogo: "" }))}
              />
            </div>
            {logoError && <p className="text-xs text-red-600 mt-1.5">{logoError}</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold px-4 py-2.5 text-sm transition"
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

        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
          <h2 className="font-bold text-slate-900 text-lg mb-3">Schools</h2>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : schools.length === 0 ? (
            <p className="text-sm text-slate-400">No schools yet — add one above.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {schools.map((s) => (
                <div key={s.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex gap-1 shrink-0">
                      <LogoThumb src={s.leftLogo} />
                      <LogoThumb src={s.rightLogo} />
                    </div>
                    <div>
                    <p className="font-bold text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.address}</p>
                    <p className="text-xs text-slate-500">{s.phone}</p>
                    <p className="text-xs text-slate-500 mt-1">Admin login ID: <span className="font-mono font-semibold">{s.adminUserId || "Not set — edit this school"}</span></p>
                    <p className="text-xs text-slate-400 mt-1">
                      {revealedId === s.id ? (
                        <>
                          Diary code: <span className="font-mono">{s.diaryCode}</span> · Admin login: <span className="font-mono">{s.adminUserId || "not set"}</span> · Password: <span>protected; reset it by editing the school</span>
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
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                      <Link className="font-semibold text-blue-700 hover:underline" to={`/school/${s.id}`}>Open diary tools ↗</Link>
                      <Link className="font-semibold text-blue-700 hover:underline" to="/login">Open admin sign-in ↗</Link>
                    </p>
                    </div>
                  </div>
                  <div className="flex gap-3 text-sm shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(s)}
                      className="text-emerald-700 hover:text-emerald-900"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
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

function Field({ label, value, onChange, placeholder, full, required = false }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input
        className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// A tiny read-only preview used in the schools list, so it's easy to
// confirm which logos are saved without opening Edit.
function LogoThumb({ src }) {
  return (
    <div className="w-8 h-8 border border-slate-200 rounded bg-white flex items-center justify-center overflow-hidden">
      {src ? (
        <img src={src} alt="" className="w-full h-full object-contain" />
      ) : (
        <span className="text-[8px] text-slate-300">—</span>
      )}
    </div>
  );
}

// A logo picker: shows a checkerboard-free preview box (so any aspect ratio
// is easy to judge) with an upload button, and a small "Remove" link once a
// logo is set. The chosen file is handed to the parent as-is; it's the
// parent's job (via onUpload) to turn it into a data URI and store it.
function LogoField({ label, value, onUpload, onRemove }) {
  const inputId = `logo-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <div className="w-14 h-14 shrink-0 border border-slate-300 rounded bg-white flex items-center justify-center overflow-hidden">
          {value ? (
            <img src={value} alt={`${label} preview`} className="w-full h-full object-contain" />
          ) : (
            <span className="text-[10px] text-slate-300 text-center px-1">No logo</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            {value ? "Change" : "Upload"}
            <input
              id={inputId}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                onUpload(file);
                e.target.value = "";
              }}
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-red-500 hover:text-red-700 text-left"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}