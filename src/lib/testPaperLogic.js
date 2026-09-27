// Pure, framework-free helpers for the Test Paper generator. Both the React
// preview (TestPaperGenerator.jsx) and the Word exporter (testPaperDocx.js)
// call these, so the on-screen preview and the downloaded .docx can never
// disagree about a mark total or an instruction line.
//
// Structure: a paper is a list of PARTS ("Objective Part", "Subjective
// Part", ...). Each part is a list of SUB-PARTS — this is what lets a
// single subjective part be split into e.g. three differently-instructed
// groups of questions (short answers / long answers / essay), each with
// its own instruction line, marks-per-question and numbering that restarts
// at 1. A part with just one sub-part (the default) behaves exactly like a
// plain part.

// Number-to-words, 0–40, just enough for "(Any fourteen)" / "(کوئی سے چودہ)"
// style instruction lines. Falls back to the digit itself past 40.
const EN_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one",
  "twenty-two", "twenty-three", "twenty-four", "twenty-five", "twenty-six",
  "twenty-seven", "twenty-eight", "twenty-nine", "thirty", "thirty-one",
  "thirty-two", "thirty-three", "thirty-four", "thirty-five", "thirty-six",
  "thirty-seven", "thirty-eight", "thirty-nine", "forty",
];

const UR_WORDS = [
  "صفر", "ایک", "دو", "تین", "چار", "پانچ", "چھ", "سات", "آٹھ", "نو", "دس",
  "گیارہ", "بارہ", "تیرہ", "چودہ", "پندرہ", "سولہ", "سترہ", "اٹھارہ",
  "انیس", "بیس", "اکیس", "بائیس", "تئیس", "چوبیس", "پچیس", "چھبیس",
  "ستائیس", "اٹھائیس", "انتیس", "تیس", "اکتیس", "بتیس", "تینتیس",
  "چونتیس", "پینتیس", "چھتیس", "سینتیس", "اڑتیس", "انتالیس", "چالیس",
];

export function numberWord(n, lang) {
  const table = lang === "ur" ? UR_WORDS : EN_WORDS;
  return table[n] !== undefined ? table[n] : String(n);
}

// Default instruction verbs per part type/language — editable per-sub-part
// by the teacher, these are just the starting text when a sub-part is added.
export const DEFAULT_VERBS = {
  mcq: {
    en: "Tick (✓) the correct answer after reading the questions carefully.",
    ur: "درست جواب پر (✓) کا نشان لگائیں",
  },
  written: {
    en: "Answer these questions",
    ur: "سوالات کے جوابات دیں",
  },
};

let uid = 1;
export const nextId = () => uid++;

export function newQuestion(type) {
  return {
    id: nextId(),
    text: "",
    options: type === "mcq" ? { a: "", b: "", c: "", d: "" } : undefined,
    shape: false,
    shapeSize: "medium", // small | medium | large — how tall the reserved diagram box is
  };
}

// A sub-part: its own (optional) label, its own instruction line, its own
// choice/marks settings, and its own numbering — everything a "part" used
// to own, now scoped so several of these can live inside one part.
export function newSubPart(type = "written") {
  return {
    id: nextId(),
    title: "", // optional short label, e.g. "Section A" — blank shows no sub-heading
    instructionVerb: { ...DEFAULT_VERBS[type] },
    // MCQs are never optional-choice (every MCQ is compulsory) — hasChoice
    // only ever applies to written sub-parts, and only the UI for written
    // sub-parts exposes it.
    hasChoice: type === "written",
    attemptCount: 0, // only meaningful when hasChoice is true
    marksPerQuestion: type === "mcq" ? 1 : 2,
    questions: [newQuestion(type)],
  };
}

export function newPart(type = "written", title = "") {
  return {
    id: nextId(),
    type, // "mcq" | "written"
    title: title || (type === "mcq" ? "Objective Part" : "Subjective Part"),
    subParts: [newSubPart(type)],
  };
}

// How many of a sub-part's questions actually get solved/marked — all of
// them for MCQs, all of them for a written sub-part with no choice, or the
// "Any N" count the teacher set for a written sub-part with choice.
export function attemptCount(subPart, type) {
  if (type === "mcq") return subPart.questions.length;
  if (subPart.hasChoice) return subPart.attemptCount || 0;
  return subPart.questions.length;
}

export function subPartTotalMarks(subPart, type) {
  return attemptCount(subPart, type) * (Number(subPart.marksPerQuestion) || 0);
}

export function partTotalMarks(part) {
  return part.subParts.reduce((sum, sp) => sum + subPartTotalMarks(sp, part.type), 0);
}

export function grandTotalMarks(parts) {
  return parts.reduce((sum, p) => sum + partTotalMarks(p), 0);
}

// Builds the printed instruction line for a sub-part, e.g.
//   EN, choice:    "Q. Answer these questions (Any fourteen):"   "(2x14)"   "/28"
//   EN, no choice: "Q. Answer these questions:"                  "(2x6)"    "/12"
//   UR, choice:    "س۔ سوالات کے جوابات دیں (کوئی سے چودہ)"      "(14x2)"   "/28"
//   MCQ (either):  "Q. Tick (✓) the correct answer…"             "(1x10)"   "/10"
// Marks are written "marks x count" in English and "count x marks" in Urdu,
// matching the two reference formats.
export function partStatement(subPart, type, lang) {
  const count = attemptCount(subPart, type);
  const marks = Number(subPart.marksPerQuestion) || 0;
  const total = count * marks;
  const marksExpr = lang === "ur" ? `(${count}x${marks})` : `(${marks}x${count})`;
  const prefix = lang === "ur" ? "س۔" : "Q.";

  let verb = (subPart.instructionVerb && subPart.instructionVerb[lang]) || DEFAULT_VERBS[type][lang];

  if (type === "written") {
    if (subPart.hasChoice && count > 0) {
      const word = numberWord(count, lang);
      verb = lang === "ur" ? `${verb} (کوئی سے ${word})` : `${verb} (Any ${word})`;
    }
    verb = lang === "ur" ? `${verb} :` : `${verb}:`;
  }

  return { prefix, verb, marksExpr, total };
}

export const SHAPE_LINES = { small: 2, medium: 4, large: 7 };