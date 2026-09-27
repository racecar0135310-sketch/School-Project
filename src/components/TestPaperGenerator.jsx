import React, { useState } from "react";
import {
  newPart,
  newQuestion,
  attemptCount,
  partTotalMarks,
  partStatement,
  grandTotalMarks,
} from "../lib/testPaperLogic.js";
import { downloadTestPaperDocx } from "../lib/testPaperDocx.js";

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
    parts: "Parts",
    addMcq: "+ Add MCQs part",
    addWritten: "+ Add subjective part",
    partTitle: "Part title",
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
    parts: "حصے",
    addMcq: "+ معروضی حصہ شامل کریں",
    addWritten: "+ انشائیہ حصہ شامل کریں",
    partTitle: "حصے کا عنوان",
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
  const [parts, setParts] = useState(() => [newPart("mcq", "Objective Part"), newPart("written", "Subjective Part")]);
  const [generating, setGenerating] = useState(false);

  const updateMeta = (key, value) => setMeta((m) => ({ ...m, [key]: value }));

  const updatePart = (id, patch) =>
    setParts((ps) => ps.map((p) => (p.id === id ? { ...p, ...(typeof patch === "function" ? patch(p) : patch) } : p)));

  const addPart = (type) =>
    setParts((ps) => [
      ...ps,
      newPart(type, type === "mcq" ? t.mcqPart : t.writtenPart),
    ]);

  const removePart = (id) => setParts((ps) => (ps.length > 1 ? ps.filter((p) => p.id !== id) : ps));

  const addQuestion = (partId) =>
    updatePart(partId, (p) => ({ questions: [...p.questions, newQuestion(p.type)] }));

  const removeQuestion = (partId, qId) =>
    updatePart(partId, (p) => ({
      questions: p.questions.length > 1 ? p.questions.filter((q) => q.id !== qId) : p.questions,
    }));

  const updateQuestion = (partId, qId, patch) =>
    updatePart(partId, (p) => ({
      questions: p.questions.map((q) => (q.id === qId ? { ...q, ...patch } : q)),
    }));

  const totalMarks = grandTotalMarks(parts);

  const handleDone = async () => {
    setGenerating(true);
    try {
      await downloadTestPaperDocx({ school, lang, meta, parts });
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
              onAddQuestion={() => addQuestion(part.id)}
              onRemoveQuestion={(qId) => removeQuestion(part.id, qId)}
              onUpdateQuestion={(qId, patch) => updateQuestion(part.id, qId, patch)}
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
        <TestPaperPreview school={school} meta={meta} parts={parts} lang={lang} t={t} totalMarks={totalMarks} />
      </section>
    </div>
  );
}

function PartEditor({ part, lang, t, onUpdate, onRemove, onAddQuestion, onRemoveQuestion, onUpdateQuestion, canRemove }) {
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

      <textarea
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        rows={1}
        value={part.instructionVerb[lang]}
        onChange={(e) =>
          onUpdate({ instructionVerb: { ...part.instructionVerb, [lang]: e.target.value } })
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t.marksEach}
          type="number"
          value={part.marksPerQuestion}
          onChange={(v) => onUpdate({ marksPerQuestion: Number(v) || 0 })}
        />
        {!isMcq && (
          <label className="flex items-center gap-2 text-sm text-slate-600 mt-5">
            <input
              type="checkbox"
              checked={part.hasChoice}
              onChange={(e) => onUpdate({ hasChoice: e.target.checked })}
            />
            {t.hasChoice}
          </label>
        )}
      </div>

      {!isMcq && part.hasChoice && (
        <Field
          label={`${t.attemptCount} (${t.ofTotal(part.questions.length)})`}
          type="number"
          value={part.attemptCount}
          onChange={(v) => onUpdate({ attemptCount: Number(v) || 0 })}
        />
      )}

      <div className="space-y-2">
        {part.questions.map((q, idx) => (
          <QuestionEditor
            key={q.id}
            index={idx}
            question={q}
            isMcq={isMcq}
            t={t}
            onUpdate={(patch) => onUpdateQuestion(q.id, patch)}
            onRemove={() => onRemoveQuestion(q.id)}
            canRemove={part.questions.length > 1}
          />
        ))}
      </div>

      <button onClick={onAddQuestion} className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
        {t.addQuestion}
      </button>

      <p className="text-[11px] text-slate-400">
        {partStatement(part, lang).prefix} {partStatement(part, lang).verb} {partStatement(part, lang).marksExpr} /
        {partStatement(part, lang).total}
      </p>
    </div>
  );
}

function QuestionEditor({ index, question, isMcq, t, onUpdate, onRemove, canRemove }) {
  return (
    <div className="border border-slate-100 rounded p-2 bg-slate-50 space-y-2">
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

// ---------------------------------------------------------------------
// Live preview — an A4-proportioned approximation of what the downloaded
// .docx will contain. It's not pixel-identical to Word's own layout, but
// every field, table, and instruction line matches 1:1.
// ---------------------------------------------------------------------
function TestPaperPreview({ school, meta, parts, lang, t, totalMarks }) {
  const dir = lang === "ur" ? "rtl" : "ltr";
  return (
    <div
      dir={dir}
      className="bg-white shadow border border-slate-300 mx-auto text-[12px] leading-snug"
      style={{ width: 560, minHeight: 790, fontFamily: lang === "ur" ? "'Noto Nastaliq Urdu', serif" : "Georgia, serif" }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center overflow-hidden shrink-0">
            {school?.leftLogo && <img src={school.leftLogo} alt="" className="w-full h-full object-contain" />}
          </div>
          <div className="text-center flex-1">
            <p className="font-bold text-base">{school?.name}</p>
            <p className="text-[10px] text-slate-500">{school?.address}</p>
            <p className="text-[10px] text-slate-500">{school?.phone}</p>
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center overflow-hidden shrink-0">
            {school?.rightLogo && <img src={school.rightLogo} alt="" className="w-full h-full object-contain" />}
          </div>
        </div>

        {meta.testName && <p className="text-center font-bold my-2">{meta.testName}</p>}

        <table className="w-full border-collapse border border-slate-400 text-[11px] mb-3">
          <tbody>
            <PreviewRow lang={lang} pairs={[[HL(lang, "Student Name", "طالب علم کا نام"), ""], [HL(lang, "Father Name", "والد کا نام"), ""]]} />
            <PreviewRow
              lang={lang}
              pairs={[
                [HL(lang, "Roll No.", "رول نمبر"), ""],
                [HL(lang, "Class", "کلاس"), meta.className],
                [HL(lang, "Section", "سیکشن"), meta.section],
              ]}
            />
            <PreviewRow
              lang={lang}
              pairs={[
                [HL(lang, "Time", "وقت"), meta.totalTime],
                [HL(lang, "Total Marks", "کل نمبر"), String(totalMarks)],
                [HL(lang, "Obt. Marks", "حاصل کردہ نمبر"), ""],
              ]}
            />
            <PreviewRow lang={lang} pairs={[[HL(lang, "Subject", "مضمون"), meta.subject], [HL(lang, "Invigilator", "نگران"), ""]]} />
          </tbody>
        </table>

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

function PreviewRow({ pairs, lang }) {
  return (
    <tr dir={lang === "ur" ? "rtl" : "ltr"}>
      {pairs.map(([label, val], i) => (
        <React.Fragment key={i}>
          <td className="border border-slate-300 bg-slate-100 font-semibold px-1.5 py-1 text-center">{label}</td>
          <td className="border border-slate-300 px-1.5 py-1 text-center">{val || "\u00A0"}</td>
        </React.Fragment>
      ))}
    </tr>
  );
}

function PreviewPart({ part, lang }) {
  const { prefix, verb, marksExpr, total } = partStatement(part, lang);
  const isMcq = part.type === "mcq";
  return (
    <div className="mb-4">
      <p className="text-center font-bold underline mb-1">{part.title}</p>
      <div className="flex items-baseline justify-between font-semibold mb-1.5">
        <span>
          {prefix} {verb}
        </span>
        <span className="whitespace-nowrap">
          {marksExpr} /{total}
        </span>
      </div>

      {isMcq ? (
        <table className="w-full border-collapse border border-slate-400 text-[10.5px]">
          <thead>
            <tr className="bg-slate-700 text-white">
              {(lang === "ur" ? ["د", "ج", "ب", "الف", "سوالات", "نمبر"] : ["No.", "Questions", "A", "B", "C", "D"]).map((h) => (
                <th key={h} className="border border-slate-500 px-1 py-1 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {part.questions.map((q, idx) => {
              const opts = [q.options?.a, q.options?.b, q.options?.c, q.options?.d];
              const cells = lang === "ur" ? [...[...opts].reverse(), q.text, idx + 1] : [idx + 1, q.text, ...opts];
              return (
                <tr key={q.id}>
                  {cells.map((c, i) => (
                    <td key={i} className="border border-slate-300 px-1 py-2 text-center align-top">
                      {c || "\u00A0"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <ol className={lang === "ur" ? "pr-4" : "pl-4"} style={{ listStyle: "decimal" }}>
          {part.questions.map((q) => (
            <li key={q.id} className="mb-1">
              {q.text || "\u00A0"}
              {q.shape && (
                <div className="border border-dashed border-slate-400 rounded mt-1" style={{ height: q.shapeSize === "large" ? 70 : q.shapeSize === "small" ? 24 : 44 }} />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}