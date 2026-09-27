// Pure, framework-free helpers for the Test Paper generator. Both the React
// preview (TestPaperGenerator.jsx) and the Word exporter (testPaperDocx.js)
// call these, so the on-screen preview and the downloaded .docx can never
// disagree about a mark total or an instruction line.

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

// Default instruction verbs per part type/language — editable per-part by
// the teacher, these are just the starting text when a part is added.
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

export function newPart(type = "written", title = "") {
  return {
    id: nextId(),
    type, // "mcq" | "written"
    title: title || (type === "mcq" ? "Objective Part" : "Subjective Part"),
    instructionVerb: { ...DEFAULT_VERBS[type] },
    // MCQs are never optional-choice (every MCQ is compulsory) — hasChoice
    // only ever applies to written parts, and only the UI for written parts
    // exposes it.
    hasChoice: type === "written",
    attemptCount: 0, // only meaningful when hasChoice is true
    marksPerQuestion: type === "mcq" ? 1 : 2,
    questions: [newQuestion(type)],
  };
}

// How many of a part's questions actually get solved/marked — all of them
// for MCQs, all of them for a written part with no choice, or the "Any N"
// count the teacher set for a written part with choice.
export function attemptCount(part) {
  if (part.type === "mcq") return part.questions.length;
  if (part.hasChoice) return part.attemptCount || 0;
  return part.questions.length;
}

export function partTotalMarks(part) {
  return attemptCount(part) * (Number(part.marksPerQuestion) || 0);
}

export function grandTotalMarks(parts) {
  return parts.reduce((sum, p) => sum + partTotalMarks(p), 0);
}

// Builds the printed instruction line for a part, e.g.
//   EN, choice:    "Q. Answer these questions (Any fourteen):"   "(2x14)"   "/28"
//   EN, no choice: "Q. Answer these questions:"                  "(2x6)"    "/12"
//   UR, choice:    "س۔ سوالات کے جوابات دیں (کوئی سے چودہ)"      "(14x2)"   "/28"
//   MCQ (either):  "Q. Tick (✓) the correct answer…"             "(1x10)"   "/10"
// Marks are written "marks x count" in English and "count x marks" in Urdu,
// matching the two reference formats.
export function partStatement(part, lang) {
  const count = attemptCount(part);
  const marks = Number(part.marksPerQuestion) || 0;
  const total = count * marks;
  const marksExpr = lang === "ur" ? `(${count}x${marks})` : `(${marks}x${count})`;
  const prefix = lang === "ur" ? "س۔" : "Q.";

  let verb = (part.instructionVerb && part.instructionVerb[lang]) || DEFAULT_VERBS[part.type][lang];

  if (part.type === "written") {
    if (part.hasChoice && count > 0) {
      const word = numberWord(count, lang);
      verb = lang === "ur" ? `${verb} (کوئی سے ${word})` : `${verb} (Any ${word})`;
    }
    verb = lang === "ur" ? `${verb} :` : `${verb}:`;
  }

  return { prefix, verb, marksExpr, total };
}

export const SHAPE_LINES = { small: 2, medium: 4, large: 7 };