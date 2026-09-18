import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import html2canvas from "html2canvas";
import { loadTeachers, findTeacherByName } from "../lib/storage.js";

const SCHOOL_NAME = "Minhaj-ul-Quran Model Secondary School";
const SCHOOL_ADDRESS = "Gulfishan Colony,Jhang Road,Faisalabad";
const SCHOOL_PHONE = "(041-265 1699-265 1290)";
const BISMILLAH = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
const DUROOD_1 =
  "اَللّٰهُمَّ صَلِّ عَلٰی مُحَمَّدٍ وَّعَلٰی آلِ مُحَمَّدٍ کَمَا صَلَّیْتَ عَلٰی اِبْرَاہِیْمَ وَعَلٰی آلِ اِبْرَاہِیْمَ اِنَّکَ حَمِیْدٌ مَّجِیْدٌ";
const DUROOD_2 =
  "اَللّٰهُمَّ بَارِکْ عَلٰی مُحَمَّدٍ وَّعَلٰی آلِ مُحَمَّدٍ کَمَا بَارَکْتَ عَلٰی اِبْرَاہِیْمَ وَعَلٰی آلِ اِبْرَاہِیْمَ اِنَّکَ حَمِیْدٌ مَّجِیْدٌ";

function todayFormatted() {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
function todayDay() {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

let idCounter = 1;
const newSubjectRow = (subject = "") => ({ id: idCounter++, subject, description: "" });

export default function DiaryPage() {
  const [teachers, setTeachers] = useState([]);
  const [meta, setMeta] = useState({
    className: "",
    section: "",
    date: todayFormatted(),
    day: todayDay(),
    incharge: "",
  });
  const [subjects, setSubjects] = useState([newSubjectRow()]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [matched, setMatched] = useState(false);

  const previewRef = useRef(null);

  useEffect(() => {
    setTeachers(loadTeachers());
  }, []);

  const updateMeta = (key, value) => setMeta((m) => ({ ...m, [key]: value }));

  const handleInchargeChange = (value) => {
    updateMeta("incharge", value);
    const teacher = findTeacherByName(teachers, value);
    if (teacher) {
      setMeta((m) => ({ ...m, className: teacher.className, section: teacher.section }));
      setSubjects(
        teacher.subjects.length
          ? teacher.subjects.map((s) => newSubjectRow(s))
          : [newSubjectRow()]
      );
      setMatched(true);
    } else {
      setMatched(false);
    }
  };

  const updateSubject = (id, key, value) =>
    setSubjects((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [key]: value } : r))
    );

  const addSubject = () => setSubjects((rows) => [...rows, newSubjectRow()]);

  const removeSubject = (id) =>
    setSubjects((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));

  const handleDone = async () => {
    if (!previewRef.current) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 3,
        backgroundColor: "#eef3e6",
        useCORS: true,
      });
      const link = document.createElement("a");
      const fileDate = meta.date.replace(/\//g, "-") || "diary";
      link.download = `homework-diary-${meta.className || "class"}-${fileDate}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-emerald-800 text-white py-4 px-6 shadow flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Daily Home Work Diary — Generator</h1>
          <p className="text-sm text-emerald-100">
            Type your name in Incharge to auto-fill your class, then add each subject's homework.
          </p>
        </div>
        <Link
          to="/admin"
          className="bg-white/10 hover:bg-white/20 text-sm font-medium px-3 py-1.5 rounded"
        >
          Admin portal
        </Link>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg shadow p-5 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-800 mb-3">Diary details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Incharge</span>
                  <input
                    list="incharge-names"
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    value={meta.incharge}
                    placeholder="Start typing your name…"
                    onChange={(e) => handleInchargeChange(e.target.value)}
                  />
                  <datalist id="incharge-names">
                    {teachers.map((t) => (
                      <option key={t.id} value={t.inchargeName} />
                    ))}
                  </datalist>
                </label>
                {matched ? (
                  <p className="text-[11px] text-emerald-600 mt-1">
                    Class, section and subjects loaded automatically.
                  </p>
                ) : (
                  teachers.length > 0 && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Not registered yet? Ask admin to add you, or fill the fields manually.
                    </p>
                  )
                )}
              </div>
              <Field label="Class" value={meta.className} onChange={(v) => updateMeta("className", v)} />
              <Field label="Section" value={meta.section} onChange={(v) => updateMeta("section", v)} />
              <Field label="Date" value={meta.date} onChange={(v) => updateMeta("date", v)} />
              <Field label="Day" value={meta.day} onChange={(v) => updateMeta("day", v)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">Subjects &amp; homework</h2>
              <button
                onClick={addSubject}
                className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
              >
                + Add subject
              </button>
            </div>

            <div className="space-y-3">
              {subjects.map((row) => (
                <div key={row.id} className="border border-slate-200 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      placeholder="Subject name (e.g. Math)"
                      value={row.subject}
                      onChange={(e) => updateSubject(row.id, "subject", e.target.value)}
                    />
                    <button
                      onClick={() => removeSubject(row.id)}
                      className="text-slate-400 hover:text-red-600 text-sm px-2"
                      title="Remove subject"
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    rows={2}
                    placeholder="Homework / diary text for this subject"
                    value={row.description}
                    onChange={(e) => updateSubject(row.id, "description", e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-slate-800 mb-2">Note (optional)</h2>
            <textarea
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              rows={2}
              placeholder="Any note for parents / students"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <button
            onClick={handleDone}
            disabled={saving}
            className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-medium rounded-md py-2.5"
          >
            {saving ? "Saving…" : "Done — Save as Image"}
          </button>
        </section>

        <section className="lg:sticky lg:top-4 self-start">
          <p className="text-xs text-slate-500 mb-2">Live preview (this is exactly what gets saved)</p>
          <div className="overflow-auto rounded shadow border border-slate-300">
            <DiaryPreview ref={previewRef} meta={meta} subjects={subjects} note={note} />
          </div>
        </section>
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

const DiaryPreview = React.forwardRef(function DiaryPreview({ meta, subjects, note }, ref) {
  return (
    <div
      ref={ref}
      style={{ background: "#eef3e6", width: 560, fontFamily: "Georgia, 'Times New Roman', serif" }}
      className="p-5 text-slate-900"
    >
      <div className="border-2 border-emerald-800 rounded-sm px-3 py-2 mb-3 flex items-center justify-between bg-[#f4f8ee]">
        <div className="w-12 h-12 rounded-full border border-slate-400 flex items-center justify-center text-[8px] text-center text-slate-500">
          crest
        </div>
        <div className="text-center flex-1">
          <h1 className="text-emerald-900 font-bold text-xl leading-tight">{SCHOOL_NAME}</h1>
          <p className="text-[11px] text-slate-700">{SCHOOL_ADDRESS}</p>
          <p className="text-[11px] text-slate-700">{SCHOOL_PHONE}</p>
        </div>
        <div className="w-12 h-12 rounded-full border border-slate-400 flex items-center justify-center text-[8px] text-center text-slate-500">
          logo
        </div>
      </div>

      <p dir="rtl" className="text-center text-lg mb-3 text-slate-800">
        {BISMILLAH}
      </p>

      <table className="w-full border-collapse border border-slate-700 text-sm mb-3">
        <tbody>
          <MetaRow label1="CLASS" value1={meta.className} label2="SECTION" value2={meta.section} />
          <MetaRow label1="DATE" value1={meta.date} label2="DAY" value2={meta.day} />
          <tr>
            <td className="border border-slate-700 px-2 py-1.5 align-middle font-semibold bg-slate-50 w-1/4">
              INCHARGE
            </td>
            <td className="border border-slate-700 px-2 py-1.5 align-middle text-blue-800" colSpan={3}>
              {meta.incharge}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 className="text-center font-bold mb-2">DAILY HOME WORK DIARY</h2>

      <table className="w-full border-collapse border border-slate-700 text-sm mb-2">
        <thead>
          <tr className="bg-emerald-200">
            <th className="border border-slate-700 px-2 py-1.5 w-1/4 text-left align-middle">SUBJECT</th>
            <th className="border border-slate-700 px-2 py-1.5 text-left align-middle">DESCRIPTION</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((row) => (
            <tr key={row.id}>
              <td className="border border-slate-700 px-2 py-2.5 font-semibold align-middle text-sky-500">
                {row.subject || "\u00A0"}
              </td>
              <td className="border border-slate-700 px-2 py-2.5 align-middle text-sky-500 whitespace-pre-wrap">
                {row.description}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border border-slate-700 px-2 py-2.5 font-semibold align-middle">NOTE</td>
            <td className="border border-slate-700 px-2 py-2.5 text-red-700 align-middle whitespace-pre-wrap">
              {note}
            </td>
          </tr>
        </tbody>
      </table>

      <div dir="rtl" className="text-center text-[13px] leading-7 text-slate-800 mt-3">
        <p>{DUROOD_1}</p>
        <p>{DUROOD_2}</p>
      </div>
    </div>
  );
});

function MetaRow({ label1, value1, label2, value2 }) {
  return (
    <tr>
      <td className="border border-slate-700 px-2 py-1.5 align-middle font-semibold bg-slate-50 w-1/4">{label1}</td>
      <td className="border border-slate-700 px-2 py-1.5 align-middle text-blue-800 w-1/4">{value1}</td>
      <td className="border border-slate-700 px-2 py-1.5 align-middle font-semibold bg-slate-50 w-1/4">{label2}</td>
      <td className="border border-slate-700 px-2 py-1.5 align-middle text-blue-800 w-1/4">{value2}</td>
    </tr>
  );
}