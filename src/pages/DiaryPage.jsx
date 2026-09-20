import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { getSchool, loadTeachers, findTeacherByName, verifySchoolCode } from "../lib/storage.js";
import AccessGate from "../components/AccessGate.jsx";

// Fixed across every school — this dua text doesn't change per school.
const BISMILLAH = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
const DUROOD_1 =
  "اَللّٰهُمَّ صَلِّ عَلٰی مُحَمَّدٍ وَّعَلٰی آلِ مُحَمَّدٍ کَمَا صَلَّیْتَ عَلٰی اِبْرَاہِیْمَ وَعَلٰی آلِ اِبْرَاہِیْمَ اِنَّکَ حَمِیْدٌ مَّجِیْدٌ";
const DUROOD_2 =
  "اَللّٰهُمَّ بَارِکْ عَلٰی مُحَمَّدٍ وَّعَلٰی آلِ مُحَمَّدٍ کَمَا بَارَکْتَ عَلٰی اِبْرَاہِیْمَ وَعَلٰی آلِ اِبْرَاہِیْمَ اِنَّکَ حَمِیْدٌ مَّجِیْدٌ";

// The diary is always laid out at this pixel width internally, so the
// downloaded image is identical quality no matter what device generated it.
const DIARY_WIDTH = 560;

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
  const { slug } = useParams();
  const sessionKey = `diary-access-${slug}`;
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(sessionKey) === "true");

  if (!unlocked) {
    return (
      <AccessGate
        title="Enter Access Code"
        subtitle="Ask your school admin for this code."
        placeholder="Enter code"
        onVerify={(code) => verifySchoolCode(slug, code)}
        onSuccess={() => {
          sessionStorage.setItem(sessionKey, "true");
          setUnlocked(true);
        }}
      />
    );
  }

  return <DiaryEditor slug={slug} />;
}

function DiaryEditor({ slug }) {
  const [school, setSchool] = useState(null);
  const [schoolError, setSchoolError] = useState("");
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

  // previewRef is the ONE diary element — both what's shown on screen
  // (scaled to fit) and what gets captured for the download (at full size,
  // by briefly removing the scale right before capture). Using a single
  // element avoids an html2canvas quirk where an off-screen duplicate
  // renders its flexbox centering incorrectly.
  const previewRef = useRef(null);
  const outerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [frameHeight, setFrameHeight] = useState(null);

  useEffect(() => {
    getSchool(slug)
      .then(setSchool)
      .catch(() => setSchoolError("Couldn't load this school's details."));
    loadTeachers(slug)
      .then(setTeachers)
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = previewRef.current;
    if (!outer || !inner) return;

    const update = () => {
      const containerWidth = outer.offsetWidth;
      const naturalHeight = inner.offsetHeight; // unaffected by transform
      if (!containerWidth || !naturalHeight) return;
      const nextScale = Math.min(containerWidth / DIARY_WIDTH, 1);
      setScale(nextScale);
      setFrameHeight(naturalHeight * nextScale);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  });

  const updateMeta = (key, value) => setMeta((m) => ({ ...m, [key]: value }));

  const handleInchargeChange = (value) => {
    updateMeta("incharge", value);
    const teacher = findTeacherByName(teachers, value);
    if (teacher) {
      setMeta((m) => ({ ...m, className: teacher.className, section: teacher.section }));
      setSubjects(
        teacher.subjects.length ? teacher.subjects.map((s) => newSubjectRow(s)) : [newSubjectRow()]
      );
      setMatched(true);
    } else {
      setMatched(false);
    }
  };

  const updateSubject = (id, key, value) =>
    setSubjects((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  const addSubject = () => setSubjects((rows) => [...rows, newSubjectRow()]);

  const removeSubject = (id) =>
    setSubjects((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));

  const handleDone = async () => {
    const node = previewRef.current;
    if (!node) return;
    setSaving(true);
    // Force the diary back to full size (undoing the on-screen responsive
    // scale) and wait for the browser to actually paint that before
    // capturing, so the downloaded image is always full quality regardless
    // of the device/screen width that triggered it.
    const prevScale = scale;
    setScale(1);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const canvas = await html2canvas(node, {
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
      setScale(prevScale);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-emerald-800 text-white py-4 px-4 sm:px-6 shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-semibold">
            {school ? school.name : "Daily Home Work Diary"}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100">
            Type your name in Incharge to auto-fill your class, then add each subject's homework.
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* ---------------- FORM ---------------- */}
        <section className="bg-white rounded-lg shadow p-4 sm:p-5 space-y-5">
          {schoolError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2">
              {schoolError}
            </div>
          )}
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

        {/* ---------------- LIVE PREVIEW ---------------- */}
        <section className="lg:sticky lg:top-4 self-start">
          <p className="text-xs text-slate-500 mb-2">Live preview (this is exactly what gets saved)</p>
          <div
            ref={outerRef}
            className="w-full overflow-hidden rounded shadow border border-slate-300"
            style={{ height: frameHeight ?? undefined }}
          >
            <DiaryPreview
              ref={previewRef}
              school={school}
              meta={meta}
              subjects={subjects}
              note={note}
              scale={scale}
            />
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

// The diary itself. School name/address/phone/logos are now dynamic (from
// whichever school this diary belongs to), same layout for every school.
const DiaryPreview = React.forwardRef(function DiaryPreview(
  { school, meta, subjects, note, scale = 1 },
  ref
) {
  return (
    <div
      ref={ref}
      style={{
        background: "#eef3e6",
        width: DIARY_WIDTH,
        fontFamily: "Georgia, 'Times New Roman', serif",
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
      className="p-5 text-slate-900 border-4 border-emerald-800 rounded-md"
    >
      <div className="border-2 border-emerald-800 rounded-sm px-3 py-2 mb-3 flex items-center justify-between bg-[#f4f8ee]">
        {school?.logoLeft ? (
          <img src={school.logoLeft} alt="" className="w-14 h-14 object-contain shrink-0" crossOrigin="anonymous" />
        ) : (
          <div className="w-14 h-14 rounded-full border border-slate-400 shrink-0" />
        )}
        <div className="text-center flex-1">
          <h1 className="text-emerald-900 font-bold text-xl leading-tight">
            {school?.name || "\u00A0"}
          </h1>
          <p className="text-[11px] text-slate-700">{school?.address}</p>
          <p className="text-[11px] text-slate-700">{school?.phone}</p>
        </div>
        {school?.logoRight ? (
          <img src={school.logoRight} alt="" className="w-14 h-14 object-contain shrink-0" crossOrigin="anonymous" />
        ) : (
          <div className="w-14 h-14 rounded-full border border-slate-400 shrink-0" />
        )}
      </div>

      <p
        dir="rtl"
        className="text-center mb-5 text-slate-900 font-semibold"
        style={{ fontSize: 28, lineHeight: 1.4 }}
      >
        {BISMILLAH}
      </p>

      <div className="border border-slate-700 text-sm mb-3">
        <Row>
          <Cell bold shaded>CLASS</Cell>
          <Cell>{meta.className}</Cell>
          <Cell bold shaded>SECTION</Cell>
          <Cell>{meta.section}</Cell>
        </Row>
        <Row noTop>
          <Cell bold shaded>DATE</Cell>
          <Cell className="text-blue-800">{meta.date}</Cell>
          <Cell bold shaded>DAY</Cell>
          <Cell className="text-blue-800">{meta.day}</Cell>
        </Row>
        <Row noTop>
          <Cell bold shaded>INCHARGE</Cell>
          <Cell grow={3} className="text-blue-800">{meta.incharge}</Cell>
        </Row>
      </div>

      <h2 className="text-center font-bold mb-2">DAILY HOME WORK DIARY</h2>

      <div className="border border-slate-700 text-sm mb-2">
        <Row className="bg-emerald-200">
          <Cell bold>SUBJECT</Cell>
          <Cell bold grow={3}>DESCRIPTION</Cell>
        </Row>
        {subjects.map((row) => (
          <Row key={row.id} noTop tall>
            <Cell bold className="text-sky-500">{row.subject || "\u00A0"}</Cell>
            <Cell grow={3} wrap className="text-sky-500">{row.description}</Cell>
          </Row>
        ))}
        <Row noTop tall>
          <Cell bold>NOTE</Cell>
          <Cell grow={3} wrap className="text-red-700">{note}</Cell>
        </Row>
      </div>

      <div dir="rtl" className="text-center text-[13px] leading-7 text-slate-800 mt-3">
        <p>{DUROOD_1}</p>
        <p>{DUROOD_2}</p>
      </div>
    </div>
  );
});

function Row({ children, className = "", noTop, tall }) {
  return (
    <div
      className={`flex w-full ${noTop ? "border-t border-slate-700" : ""} ${
        tall ? "min-h-[46px]" : "min-h-[34px]"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function Cell({ bold, shaded, wrap, grow = 1, className = "", children }) {
  return (
    <div
      style={{ flexGrow: grow, flexBasis: 0 }}
      className={`flex items-center justify-center text-center border-l border-slate-700 first:border-l-0 px-2 py-1.5 ${
        shaded ? "bg-slate-50" : ""
      } ${bold ? "font-semibold" : ""} ${wrap ? "whitespace-pre-wrap" : ""} ${className}`}
    >
      {children}
    </div>
  );
}