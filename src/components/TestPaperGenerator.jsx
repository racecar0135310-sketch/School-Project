import React, { useState } from "react";
import {
  newPart,
  newSubPart,
  newQuestion,
  attemptCount,
  partTotalMarks,
  partStatement,
  grandTotalMarks,
} from "../lib/testPaperLogic.js";
import { downloadTestPaperDocx } from "../lib/testPaperDocx.js";

// Same fallback logos the diary uses when a school hasn't uploaded its own —
// keeps the test paper's header consistent with the diary everywhere.
const DEFAULT_LEFT_LOGO = "/logos/minhaj-ul-quran-logo.png";
const DEFAULT_RIGHT_LOGO = "/logos/minhaj-education-society-logo.png";

// A piece of user-typed text isn't guaranteed to match the paper's overall
// language (an English question can appear inside an Urdu paper, and vice
// versa) — detecting the actual script keeps the live preview's alignment
// and option-lettering consistent with what the downloaded .docx will show.
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
function detectLang(text, fallbackLang) {
  if (!text) return fallbackLang;
  return ARABIC_RANGE.test(text) ? "ur" : "en";
}

const ENGLISH_FONTS = ["Cambria", "Times New Roman", "Calibri", "Arial", "Georgia", "Verdana"];
const URDU_FONTS = [
  "Jameel Noori Nastaleeq",
  "Alvi Nastaleeq",
  "Nafees Nastaleeq",
  "Fajer Noori Nastalique",
];

const T = {
  en: {
    langLabel: "Paper language",
    english: "English",
    urdu: "Urdu",
    paperDetails: "Paper details",
    testName: "Test paper name",
    testNamePh: "e.g. First Term Exam 2026",
    class: "Class",
    section: "Section",
    subject: "Subject",
    time: "Total time",
    timePh: "e.g. 1 hour 30 min",
    fontSectionTitle: "Font",
    englishFontLabel: "English font",
    urduFontLabel: "Urdu font",
    fontSizeLabel: "Base font size (pt)",
    fontHint: "Applies to the whole document — headings and labels scale with it.",
    parts: "Parts",
    addMcq: "+ Add MCQs part",
    addWritten: "+ Add subjective part",
    partTitle: "Part title",
    subPartTitle: "Sub-part label (optional, e.g. Section A)",
    addSubPart: "+ Add sub-part",
    removeSubPart: "Remove sub-part",
    marksEach: "Marks per question",
    hasChoice: "There is choice (student attempts only some questions)",
    attemptCount: "How many must the student attempt?",
    ofTotal: (n) => `out of ${n} questions written below`,
    question: "Question",
    addQuestion: "+ Add question",
    removeQuestion: "Remove",
    removePart: "Remove part",
    optionA: "Option A",
    optionB: "Option B",
    optionC: "Option C",
    optionD: "Option D",
    shape: "+ Diagram / shape space",
    shapeOn: "Diagram space added",
    small: "Small",
    medium: "Medium",
    large: "Large",
    preview: "Live preview",
    totalMarks: "Total marks",
    done: "Done — Download as Word (.docx)",
    generating: "Preparing document…",
    mcqPart: "MCQs part",
    writtenPart: "Subjective part",
  },
  ur: {
    langLabel: "پیپر کی زبان",
    english: "انگلش",
    urdu: "اردو",
    paperDetails: "پیپر کی تفصیلات",
    testName: "ٹیسٹ پیپر کا نام",
    testNamePh: "مثلاً پہلا ٹرم امتحان 2026",
    class: "کلاس",
    section: "سیکشن",
    subject: "مضمون",
    time: "کل وقت",
    timePh: "مثلاً 1 گھنٹہ 30 منٹ",
    fontSectionTitle: "فونٹ",
    englishFontLabel: "انگلش فونٹ",
    urduFontLabel: "اردو فونٹ",
    fontSizeLabel: "بنیادی فونٹ سائز (pt)",
    fontHint: "پوری دستاویز پر لاگو ہوتا ہے — عنوانات اور لیبل اسی کے مطابق بڑے/چھوٹے ہوں گے۔",
    parts: "حصے",
    addMcq: "+ معروضی حصہ شامل کریں",
    addWritten: "+ انشائیہ حصہ شامل کریں",
    partTitle: "حصے کا عنوان",
    subPartTitle: "ذیلی حصے کا لیبل (اختیاری، مثلاً سیکشن اے)",
    addSubPart: "+ ذیلی حصہ شامل کریں",
    removeSubPart: "ذیلی حصہ حذف کریں",
    marksEach: "فی سوال نمبر",
    hasChoice: "چوائس ہے (طالبعلم صرف کچھ سوالات حل کرے گا)",
    attemptCount: "طالبعلم کتنے سوال حل کرے گا؟",
    ofTotal: (n) => `${n} سوالات میں سے`,
    question: "سوال",
    addQuestion: "+ سوال شامل کریں",
    removeQuestion: "حذف کریں",
    removePart: "حصہ حذف کریں",
    optionA: "الف",
    optionB: "ب",
    optionC: "ج",
    optionD: "د",
    shape: "+ شکل / خالی جگہ شامل کریں",
    shapeOn: "خالی جگہ شامل ہو گئی",
    small: "چھوٹی",
    medium: "درمیانی",
    large: "بڑی",
    preview: "لائیو پیش منظر",
    totalMarks: "کل نمبر",
    done: "تیار — ورڈ فائل (.docx) ڈاؤن لوڈ کریں",
    generating: "دستاویز تیار ہو رہی ہے…",
    mcqPart: "معروضی حصہ",
    writtenPart: "انشائیہ حصہ",
  },
};

export default function TestPaperGenerator({ school }) {
  const [lang, setLang] = useState("en");
  const t = T[lang];
  const [meta, setMeta] = useState({ testName: "", className: "", section: "", subject: "", totalTime: "" });
  const [style, setStyle] = useState({ fontFamilyEn: "Cambria", fontFamilyUr: "Jameel Noori Nastaleeq", fontSize: 11 });
  const [parts, setParts] = useState(() => [newPart("mcq", "Objective Part"), newPart("written", "Subjective Part")]);
  const [generating, setGenerating] = useState(false);

  const updateMeta = (key, value) => setMeta((m) => ({ ...m, [key]: value }));
  const updateStyle = (key, value) => setStyle((s) => ({ ...s, [key]: value }));

  const updatePart = (id, patch) =>
    setParts((ps) => ps.map((p) => (p.id === id ? { ...p, ...(typeof patch === "function" ? patch(p) : patch) } : p)));

  const addPart = (type) =>
    setParts((ps) => [
      ...ps,
      newPart(type, type === "mcq" ? t.mcqPart : t.writtenPart),
    ]);

  const removePart = (id) => setParts((ps) => (ps.length > 1 ? ps.filter((p) => p.id !== id) : ps));

  // Every mutation below drills down: part -> subPart -> question.
  const updateSubPart = (partId, subId, patch) =>
    updatePart(partId, (p) => ({
      subParts: p.subParts.map((sp) =>
        sp.id === subId ? { ...sp, ...(typeof patch === "function" ? patch(sp) : patch) } : sp
      ),
    }));

  const addSubPart = (partId, type) =>
    updatePart(partId, (p) => ({ subParts: [...p.subParts, newSubPart(type)] }));

  const removeSubPart = (partId, subId) =>
    updatePart(partId, (p) => ({
      subParts: p.subParts.length > 1 ? p.subParts.filter((sp) => sp.id !== subId) : p.subParts,
    }));

  const addQuestion = (partId, subId, type) =>
    updateSubPart(partId, subId, (sp) => ({ questions: [...sp.questions, newQuestion(type)] }));

  const removeQuestion = (partId, subId, qId) =>
    updateSubPart(partId, subId, (sp) => ({
      questions: sp.questions.length > 1 ? sp.questions.filter((q) => q.id !== qId) : sp.questions,
    }));

  const updateQuestion = (partId, subId, qId, patch) =>
    updateSubPart(partId, subId, (sp) => ({
      questions: sp.questions.map((q) => (q.id === qId ? { ...q, ...patch } : q)),
    }));

  const totalMarks = grandTotalMarks(parts);

  const handleDone = async () => {
    setGenerating(true);
    try {
      await downloadTestPaperDocx({ school, lang, meta, parts, style });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {/* ---------------- FORM ---------------- */}
      <section className="bg-white rounded-lg shadow p-4 sm:p-5 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">{t.langLabel}</span>
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-sm">
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-1 ${lang === "en" ? "bg-emerald-700 text-white" : "bg-white text-slate-600"}`}
            >
              {t.english}
            </button>
            <button
              onClick={() => setLang("ur")}
              className={`px-3 py-1 ${lang === "ur" ? "bg-emerald-700 text-white" : "bg-white text-slate-600"}`}
            >
              {t.urdu}
            </button>
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-slate-800 mb-3">{t.paperDetails}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label={t.testName} value={meta.testName} onChange={(v) => updateMeta("testName", v)} placeholder={t.testNamePh} />
            </div>
            <Field label={t.class} value={meta.className} onChange={(v) => updateMeta("className", v)} />
            <Field label={t.section} value={meta.section} onChange={(v) => updateMeta("section", v)} />
            <Field label={t.subject} value={meta.subject} onChange={(v) => updateMeta("subject", v)} />
            <Field label={t.time} value={meta.totalTime} onChange={(v) => updateMeta("totalTime", v)} placeholder={t.timePh} />
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-slate-800 mb-1">{t.fontSectionTitle}</h2>
          <p className="text-[11px] text-slate-400 mb-3">{t.fontHint}</p>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label={t.englishFontLabel}
              value={style.fontFamilyEn}
              onChange={(v) => updateStyle("fontFamilyEn", v)}
              options={ENGLISH_FONTS}
            />
            <SelectField
              label={t.urduFontLabel}
              value={style.fontFamilyUr}
              onChange={(v) => updateStyle("fontFamilyUr", v)}
              options={URDU_FONTS}
            />
            <Field
              label={t.fontSizeLabel}
              type="number"
              value={style.fontSize}
              onChange={(v) => updateStyle("fontSize", Math.min(18, Math.max(8, Number(v) || 11)))}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">{t.parts}</h2>
            <div className="flex gap-3">
              <button onClick={() => addPart("mcq")} className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
                {t.addMcq}
              </button>
              <button onClick={() => addPart("written")} className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
                {t.addWritten}
              </button>
            </div>
          </div>

          {parts.map((part) => (
            <PartEditor
              key={part.id}
              part={part}
              lang={lang}
              t={t}
              onUpdate={(patch) => updatePart(part.id, patch)}
              onRemove={() => removePart(part.id)}
              onAddSubPart={() => addSubPart(part.id, part.type)}
              onUpdateSubPart={(subId, patch) => updateSubPart(part.id, subId, patch)}
              onRemoveSubPart={(subId) => removeSubPart(part.id, subId)}
              onAddQuestion={(subId) => addQuestion(part.id, subId, part.type)}
              onRemoveQuestion={(subId, qId) => removeQuestion(part.id, subId, qId)}
              onUpdateQuestion={(subId, qId, patch) => updateQuestion(part.id, subId, qId, patch)}
              canRemove={parts.length > 1}
            />
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <span className="text-sm font-semibold text-slate-700">
            {t.totalMarks}: <span className="text-emerald-700">{totalMarks}</span>
          </span>
        </div>

        <button
          onClick={handleDone}
          disabled={generating}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-medium rounded-md py-2.5"
        >
          {generating ? t.generating : t.done}
        </button>
      </section>

      {/* ---------------- LIVE PREVIEW ---------------- */}
      <section className="lg:sticky lg:top-4 self-start">
        <p className="text-xs text-slate-500 mb-2">{t.preview}</p>
        <TestPaperPreview school={school} meta={meta} parts={parts} lang={lang} t={t} totalMarks={totalMarks} style={style} />
      </section>
    </div>
  );
}

function PartEditor({
  part,
  lang,
  t,
  onUpdate,
  onRemove,
  onAddSubPart,
  onUpdateSubPart,
  onRemoveSubPart,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  canRemove,
}) {
  const isMcq = part.type === "mcq";
  const dir = lang === "ur" ? "rtl" : "ltr";

  return (
    <div className="border border-slate-200 rounded-md p-3 space-y-3" dir={dir}>
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
            isMcq ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {isMcq ? t.mcqPart : t.writtenPart}
        </span>
        <input
          className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
          value={part.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder={t.partTitle}
        />
        {canRemove && (
          <button onClick={onRemove} className="text-slate-400 hover:text-red-600 text-sm px-2" title={t.removePart}>
            ✕
          </button>
        )}
      </div>

      <div className="space-y-3">
        {part.subParts.map((subPart, spIdx) => (
          <SubPartEditor
            key={subPart.id}
            subPart={subPart}
            isMcq={isMcq}
            lang={lang}
            t={t}
            index={spIdx}
            onUpdate={(patch) => onUpdateSubPart(subPart.id, patch)}
            onRemove={() => onRemoveSubPart(subPart.id)}
            onAddQuestion={() => onAddQuestion(subPart.id)}
            onRemoveQuestion={(qId) => onRemoveQuestion(subPart.id, qId)}
            onUpdateQuestion={(qId, patch) => onUpdateQuestion(subPart.id, qId, patch)}
            canRemove={part.subParts.length > 1}
          />
        ))}
      </div>

      <button onClick={onAddSubPart} className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
        {t.addSubPart}
      </button>
    </div>
  );
}

// One sub-part: its own optional label, its own instruction line, its own
// marks/choice settings, and its own list of questions. A part with a
// single (unlabeled) sub-part looks exactly like a plain part always did;
// adding more sub-parts is what lets one part be split into e.g. three
// differently-instructed groups of questions.
function SubPartEditor({
  subPart,
  isMcq,
  lang,
  t,
  index,
  onUpdate,
  onRemove,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  canRemove,
}) {
  return (
    <div className="border border-slate-100 bg-slate-50/60 rounded-md p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-400 shrink-0">#{index + 1}</span>
        <input
          className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
          value={subPart.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder={t.subPartTitle}
        />
        {canRemove && (
          <button onClick={onRemove} className="text-slate-400 hover:text-red-600 text-xs px-2" title={t.removeSubPart}>
            ✕
          </button>
        )}
      </div>

      <textarea
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        rows={1}
        value={subPart.instructionVerb[lang]}
        onChange={(e) =>
          onUpdate({ instructionVerb: { ...subPart.instructionVerb, [lang]: e.target.value } })
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t.marksEach}
          type="number"
          value={subPart.marksPerQuestion}
          onChange={(v) => onUpdate({ marksPerQuestion: Number(v) || 0 })}
        />
        {!isMcq && (
          <label className="flex items-center gap-2 text-sm text-slate-600 mt-5">
            <input
              type="checkbox"
              checked={subPart.hasChoice}
              onChange={(e) => onUpdate({ hasChoice: e.target.checked })}
            />
            {t.hasChoice}
          </label>
        )}
      </div>

      {!isMcq && subPart.hasChoice && (
        <Field
          label={`${t.attemptCount} (${t.ofTotal(subPart.questions.length)})`}
          type="number"
          value={subPart.attemptCount}
          onChange={(v) => onUpdate({ attemptCount: Number(v) || 0 })}
        />
      )}

      <div className="space-y-2">
        {subPart.questions.map((q, idx) => (
          <QuestionEditor
            key={q.id}
            index={idx}
            question={q}
            isMcq={isMcq}
            t={t}
            onUpdate={(patch) => onUpdateQuestion(q.id, patch)}
            onRemove={() => onRemoveQuestion(q.id)}
            canRemove={subPart.questions.length > 1}
          />
        ))}
      </div>

      <button onClick={onAddQuestion} className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
        {t.addQuestion}
      </button>

      <p className="text-[11px] text-slate-400">
        {partStatement(subPart, isMcq ? "mcq" : "written", lang).prefix}{" "}
        {partStatement(subPart, isMcq ? "mcq" : "written", lang).verb}{" "}
        {partStatement(subPart, isMcq ? "mcq" : "written", lang).marksExpr} /
        {partStatement(subPart, isMcq ? "mcq" : "written", lang).total}
      </p>
    </div>
  );
}

function QuestionEditor({ index, question, isMcq, t, onUpdate, onRemove, canRemove }) {
  return (
    <div className="border border-slate-100 rounded p-2 bg-white space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xs font-semibold text-slate-400 mt-2 w-5 shrink-0">{index + 1}.</span>
        <textarea
          className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          rows={1}
          placeholder={`${t.question} ${index + 1}`}
          value={question.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
        />
        {canRemove && (
          <button onClick={onRemove} className="text-slate-400 hover:text-red-600 text-xs px-1 mt-2" title={t.removeQuestion}>
            ✕
          </button>
        )}
      </div>

      {isMcq && (
        <div className="grid grid-cols-2 gap-2 pl-7">
          <input
            className="border border-slate-300 rounded px-2 py-1 text-xs"
            placeholder={t.optionA}
            value={question.options?.a || ""}
            onChange={(e) => onUpdate({ options: { ...question.options, a: e.target.value } })}
          />
          <input
            className="border border-slate-300 rounded px-2 py-1 text-xs"
            placeholder={t.optionB}
            value={question.options?.b || ""}
            onChange={(e) => onUpdate({ options: { ...question.options, b: e.target.value } })}
          />
          <input
            className="border border-slate-300 rounded px-2 py-1 text-xs"
            placeholder={t.optionC}
            value={question.options?.c || ""}
            onChange={(e) => onUpdate({ options: { ...question.options, c: e.target.value } })}
          />
          <input
            className="border border-slate-300 rounded px-2 py-1 text-xs"
            placeholder={t.optionD}
            value={question.options?.d || ""}
            onChange={(e) => onUpdate({ options: { ...question.options, d: e.target.value } })}
          />
        </div>
      )}

      <div className="flex items-center gap-2 pl-7">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={question.shape} onChange={(e) => onUpdate({ shape: e.target.checked })} />
          {question.shape ? t.shapeOn : t.shape}
        </label>
        {question.shape && (
          <select
            className="border border-slate-300 rounded text-xs px-1 py-0.5"
            value={question.shapeSize}
            onChange={(e) => onUpdate({ shapeSize: e.target.value })}
          >
            <option value="small">{t.small}</option>
            <option value="medium">{t.medium}</option>
            <option value="large">{t.large}</option>
          </select>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input
        type={type}
        className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <select
        className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------
// Live preview — an A4-proportioned approximation of what the downloaded
// .docx will contain. It's not pixel-identical to Word's own layout, but
// every field, table, and instruction line matches 1:1 — the chosen font
// family/size, the Father Name/Invigilator boxes' extra width, the
// left/right logos (with the same fallback the diary uses), and each
// question's own detected language all mirror the exported document.
// ---------------------------------------------------------------------
function TestPaperPreview({ school, meta, parts, lang, t, totalMarks, style }) {
  const dir = lang === "ur" ? "rtl" : "ltr";
  const fontFamily =
    lang === "ur"
      ? `'${style.fontFamilyUr}', 'Noto Nastaliq Urdu', serif`
      : `'${style.fontFamilyEn}', Georgia, serif`;
  const baseFontPx = (Number(style.fontSize) || 11) * 1.14; // rough pt->px preview scale, matches the old 12.5px default at 11pt

  return (
    <div
      dir={dir}
      className="bg-white shadow border border-slate-300 mx-auto leading-snug"
      style={{
        width: 560,
        minHeight: 790,
        fontFamily,
        fontSize: baseFontPx,
      }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center overflow-hidden shrink-0">
            <img src={school?.leftLogo || DEFAULT_LEFT_LOGO} alt="" className="w-full h-full object-contain" />
          </div>
          <div className="text-center flex-1">
            <p className="font-bold text-base">{school?.name}</p>
            <p className="text-[10px] text-slate-500">{school?.address}</p>
            <p className="text-[10px] text-slate-500">{school?.phone}</p>
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center overflow-hidden shrink-0">
            <img src={school?.rightLogo || DEFAULT_RIGHT_LOGO} alt="" className="w-full h-full object-contain" />
          </div>
        </div>

        {meta.testName && <p className="text-center font-bold my-2">{meta.testName}</p>}

        {/*
          Built as flex rows (not an HTML <table>) on purpose: a real
          <table> with table-layout:fixed locks every row's column
          boundaries to whatever the FIRST row declares, so a 6-cell row
          under a 4-cell row either overflows or gets silently clipped —
          which is exactly why "Section" and "Obt. Marks" used to render
          outside the box instead of as a proper cell. Each flex row below
          is independent and always fills the full 100% width, so every
          row's last box (Father Name, Section, Obt. Marks, Invigilator)
          ends flush with the same right edge — their border lines meet.
        */}
        <div className="border-t border-l border-slate-400 text-[9px] mb-3">
          <HeaderGridRow
            lang={lang}
            cells={[
              [HL(lang, "Student Name", "طالب علم کا نام"), "", "15%", "28%"],
              [HL(lang, "Father Name", "والد کا نام"), "", "12%", "45%"],
            ]}
          />
          <HeaderGridRow
            lang={lang}
            cells={[
              [HL(lang, "Roll No.", "رول نمبر"), "", "17%", "19%"],
              [HL(lang, "Class", "کلاس"), meta.className, "15%", "16%"],
              [HL(lang, "Section", "سیکشن"), meta.section, "13%", "20%"],
            ]}
          />
          <HeaderGridRow
            lang={lang}
            cells={[
              [HL(lang, "Time", "وقت"), meta.totalTime, "17%", "19%"],
              [HL(lang, "Total Marks", "کل نمبر"), String(totalMarks), "15%", "16%"],
              [HL(lang, "Obt. Marks", "حاصل کردہ نمبر"), "", "13%", "20%"],
            ]}
          />
          <HeaderGridRow
            lang={lang}
            cells={[
              [HL(lang, "Subject", "مضمون"), meta.subject, "15%", "28%"],
              [HL(lang, "Invigilator", "نگران"), "", "12%", "45%"],
            ]}
          />
        </div>

        {parts.map((part) => (
          <PreviewPart key={part.id} part={part} lang={lang} />
        ))}
      </div>
    </div>
  );
}

// Tiny label helper so the header table shows real Urdu words in preview
// (not just mirrored English), matching what the exported .docx will say.
function HL(lang, en, ur) {
  return lang === "ur" ? ur : en;
}

// One row of the header grid. Every cell only draws its right + bottom
// border; the outer wrapper (see above) supplies the top + left border
// once for the whole grid — the same "collapsed border" trick the diary's
// own GridCell uses — so each box still reads as one complete rectangle
// with no doubled-up lines between rows.
function HeaderGridRow({ cells, lang }) {
  return (
    <div dir={lang === "ur" ? "rtl" : "ltr"} className="flex">
      {cells.map(([label, val, labelW, valW], i) => (
        <React.Fragment key={i}>
          <div
            style={{ flex: `0 0 ${labelW}` }}
            className="border-r border-b border-slate-400 bg-slate-100 font-semibold px-1.5 py-1.5 text-center"
          >
            {label}
          </div>
          <div style={{ flex: `0 0 ${valW}` }} className="border-r border-b border-slate-400 px-1.5 py-1.5 text-center">
            {val || "\u00A0"}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function PreviewPart({ part, lang }) {
  const isMcq = part.type === "mcq";
  return (
    <div className="mb-4">
      <p className="text-center font-bold underline mb-1">{part.title}</p>
      {part.subParts.map((subPart) => (
        <PreviewSubPart key={subPart.id} subPart={subPart} type={part.type} isMcq={isMcq} lang={lang} />
      ))}
    </div>
  );
}

function PreviewSubPart({ subPart, type, isMcq, lang }) {
  const { prefix, verb, marksExpr, total } = partStatement(subPart, type, lang);
  const verbLang = detectLang(verb, lang);
  return (
    <div className="mb-3">
      {subPart.title && <p className="font-semibold text-[11px] mb-1">{subPart.title}</p>}
      <div dir={verbLang === "ur" ? "rtl" : "ltr"} className="flex items-baseline justify-between font-semibold mb-1.5 text-[11px]">
        <span>
          {prefix} {verb}
        </span>
        <span className="whitespace-nowrap">
          {marksExpr} /{total}
        </span>
      </div>

      {isMcq ? (
        <div className="border-t border-l border-slate-300 flex flex-wrap">
          {subPart.questions.map((q, idx) => {
            const qLang = detectLang(q.text, lang);
            const optPairs =
              qLang === "ur"
                ? [["ب", q.options?.b], ["الف", q.options?.a], ["د", q.options?.d], ["ج", q.options?.c]]
                : [["A", q.options?.a], ["B", q.options?.b], ["C", q.options?.c], ["D", q.options?.d]];
            return (
              <div
                key={q.id}
                dir={qLang === "ur" ? "rtl" : "ltr"}
                className="w-full border-r border-b border-slate-300 px-2 py-1.5"
              >
                <p className="text-[11px] mb-1 font-medium">
                  <span className="font-semibold">{idx + 1}. </span>
                  {q.text || "\u00A0"}
                </p>
                <div
                  className={`grid grid-cols-2 border border-slate-200 rounded overflow-hidden text-[9px] ${
                    qLang === "ur" ? "mr-4" : "ml-4"
                  }`}
                >
                  {optPairs.map(([label, val], i) => (
                    <div
                      key={i}
                      className={`px-2 py-1 ${i % 2 === 0 ? "border-r" : ""} ${
                        i < 2 ? "border-b" : ""
                      } border-slate-200`}
                    >
                      <span className="font-semibold">{label}) </span>
                      {val || "\u00A0"}
                    </div>
                  ))}
                </div>
                {q.shape && (
                  <div
                    className={`border border-dashed border-slate-400 rounded mt-1.5 ${qLang === "ur" ? "mr-4" : "ml-4"}`}
                    style={{ height: q.shapeSize === "large" ? 70 : q.shapeSize === "small" ? 24 : 44 }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <ol className="text-[11px]" style={{ listStyle: "decimal" }}>
          {subPart.questions.map((q) => {
            const qLang = detectLang(q.text, lang);
            return (
              <li key={q.id} dir={qLang === "ur" ? "rtl" : "ltr"} className={`mb-1 ${qLang === "ur" ? "pr-4" : "pl-4"}`}>
                {q.text || "\u00A0"}
                {q.shape && (
                  <div
                    className="border border-dashed border-slate-400 rounded mt-1"
                    style={{ height: q.shapeSize === "large" ? 70 : q.shapeSize === "small" ? 24 : 44 }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}