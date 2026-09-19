import React, { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { loadTeachers, findTeacherByName } from "../lib/storage.js";
import AccessGate from "../components/AccessGate.jsx";

const DIARY_ACCESS_CODE = "135135";
const DIARY_SESSION_KEY = "diary-access-granted";

// Logos live in /public/logos so they load with a plain, absolute path —
// this works the same in dev, build, and preview, with no bundler import needed.
const minhajUlQuranLogo = "/logos/minhaj-ul-quran-logo.png";
const mesLogo = "/logos/minhaj-education-society-logo.jpg";

// ---- Fixed template text (same every time, matches the school's printed diary) ----
const SCHOOL_NAME = "Minhaj-ul-Quran Model Secondary School";
const SCHOOL_ADDRESS = "Gulfishan Colony,Jhang Road,Faisalabad";
const SCHOOL_PHONE = "(041-265 1699-265 1290)";
const BISMILLAH = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
const DUROOD_1 =
  "اَللّٰهُمَّ صَلِّ عَلٰی مُحَمَّدٍ وَّعَلٰی آلِ مُحَمَّدٍ کَمَا صَلَّیْتَ عَلٰی اِبْرَاہِیْمَ وَعَلٰی آلِ اِبْرَاہِیْمَ اِنَّکَ حَمِیْدٌ مَّجِیْدٌ";
const DUROOD_2 =
  "اَللّٰهُمَّ بَارِکْ عَلٰی مُحَمَّدٍ وَّعَلٰی آلِ مُحَمَّدٍ کَمَا بَارَکْتَ عَلٰی اِبْرَاہِیْمَ وَعَلٰی آلِ اِبْرَاہِیْمَ اِنَّکَ حَمِیْدٌ مَّجِیْدٌ";

// The diary is always laid out at this pixel width internally, so the
// downloaded image is identical quality no matter what device generated it.
// On screen it's scaled down to fit — see ResponsiveDiaryFrame below.
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
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(DIARY_SESSION_KEY) === "true"
  );
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

  // previewRef points at a full-size (560px), off-screen copy of the diary —
  // this is what actually gets captured for the download, always at full
  // resolution regardless of the visitor's screen size.
  const previewRef = useRef(null);

  useEffect(() => {
    setTeachers(loadTeachers());
  }, []);

  const updateMeta = (key, value) => setMeta((m) => ({ ...m, [key]: value }));

  // When the incharge name matches a saved teacher, auto-fill class, section
  // and the subject list for that class (keeping date/day as-is, since those
  // already default to today and the teacher may be doing a diary for
  // another day).
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

  // "Done" -> render the diary at high resolution and save as PNG. This
  // always captures the full-size (unscaled) off-screen copy, so the file
  // comes out identical whether triggered from a phone or a desktop.
  const handleDone = async () => {
    if (!previewRef.current) return;
    setSaving(true);
    try {
      // html-to-image renders through the browser's own engine (via an SVG
      // <foreignObject>), so the PNG comes out pixel-identical to the live
      // preview — no separate text/layout re-implementation to disagree with
      // what's on screen, unlike html2canvas.
      const dataUrl = await toPng(previewRef.current, {
        pixelRatio: 3,
        backgroundColor: "#eef3e6",
        cacheBust: true,
      });
      const link = document.createElement("a");
      const fileDate = meta.date.replace(/\//g, "-") || "diary";
      link.download = `homework-diary-${meta.className || "class"}-${fileDate}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setSaving(false);
    }
  };

  if (!unlocked) {
    return (
      <AccessGate
        title="Daily Home Work Diary"
        subtitle="Enter the access code to continue."
        expected={DIARY_ACCESS_CODE}
        placeholder="Enter code"
        onSuccess={() => {
          sessionStorage.setItem(DIARY_SESSION_KEY, "true");
          setUnlocked(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-emerald-800 text-white py-4 px-4 sm:px-6 shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-semibold">Daily Home Work Diary — Generator</h1>
          <p className="text-xs sm:text-sm text-emerald-100">
            Type your name in Incharge to auto-fill your class, then add each subject's homework.
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* ---------------- FORM ---------------- */}
        <section className="bg-white rounded-lg shadow p-4 sm:p-5 space-y-5">
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

        {/* ---------------- LIVE PREVIEW (responsive on-screen copy) ---------------- */}
        <section className="lg:sticky lg:top-4 self-start">
          <p className="text-xs text-slate-500 mb-2">Live preview (this is exactly what gets saved)</p>
          <ResponsiveDiaryFrame>
            <DiaryPreview meta={meta} subjects={subjects} note={note} />
          </ResponsiveDiaryFrame>
        </section>

        {/* Full-size, off-screen copy used only for the image export — always
            renders at DIARY_WIDTH regardless of the viewer's screen size, so
            the downloaded PNG is identical quality on phone or desktop. */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", top: 0, left: -99999, pointerEvents: "none" }}
        >
          <DiaryPreview ref={previewRef} meta={meta} subjects={subjects} note={note} />
        </div>
      </main>
    </div>
  );
}

// Scales its child (assumed to be DIARY_WIDTH px wide) down to fit whatever
// width is available — phone, tablet, or desktop — using a CSS transform, so
// the diary is always fully visible on screen with no horizontal scrolling.
// The child's own layout size never changes, only how it's painted, so this
// has no effect on the separate full-size copy used for the actual download.
function ResponsiveDiaryFrame({ children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const update = () => {
      const containerWidth = outer.offsetWidth;
      const naturalHeight = inner.offsetHeight;
      if (!containerWidth || !naturalHeight) return;
      const nextScale = Math.min(containerWidth / DIARY_WIDTH, 1);
      setScale(nextScale);
      setHeight(naturalHeight * nextScale);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  });

  return (
    <div
      ref={outerRef}
      className="w-full overflow-hidden rounded shadow border border-slate-300"
      style={{ height: height ?? undefined }}
    >
      <div
        ref={innerRef}
        style={{ width: DIARY_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
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

// The diary itself, styled to match the school's printed template.
const DiaryPreview = React.forwardRef(function DiaryPreview({ meta, subjects, note }, ref) {
  return (
    <div
      ref={ref}
      style={{ background: "#eef3e6", width: DIARY_WIDTH, fontFamily: "Georgia, 'Times New Roman', serif" }}
      className="p-5 text-slate-900 border-4 border-emerald-800 rounded-md"
    >
      {/* Header banner */}
      <div className="border-2 border-emerald-800 rounded-sm px-3 py-2 mb-3 flex items-center justify-between bg-[#f4f8ee]">
        <img
          src={minhajUlQuranLogo}
          alt="Minhaj-ul-Quran"
          className="w-14 h-14 object-contain shrink-0"
        />
        <div className="text-center flex-1">
          <h1 className="text-emerald-900 font-bold text-xl leading-tight">{SCHOOL_NAME}</h1>
          <p className="text-[11px] text-slate-700">{SCHOOL_ADDRESS}</p>
          <p className="text-[11px] text-slate-700">{SCHOOL_PHONE}</p>
        </div>
        <img
          src={mesLogo}
          alt="Minhaj Education Society"
          className="w-14 h-14 object-contain shrink-0"
        />
      </div>

      <p
        dir="rtl"
        className="text-center mb-5 text-slate-900 font-semibold"
        style={{ fontSize: 28, lineHeight: 1.4 }}
      >
        {BISMILLAH}
      </p>

      {/* Meta grid (built with plain divs, not a <table>, so html2canvas
          exports vertical centering exactly like the live preview) */}
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

      {/* Subjects grid */}
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

// A row of the grid: a flex container that stretches all its cells to equal
// height (default flex "stretch" behavior — no percentage heights needed).
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

// A grid cell: itself a flex container (not a wrapper needing h-full), so it
// centers its own content correctly whether rendered by the browser or by
// html2canvas when exporting the diary as an image.
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