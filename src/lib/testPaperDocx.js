// Builds the test paper as an actual .docx (A4, portrait) using the `docx`
// package, and triggers a browser download — the same "what you see in the
// preview is what you get" idea as the diary's PNG export, just aimed at
// Word instead of an image.
//
// Run `npm install docx` in the client project before using this file.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  VerticalAlign,
  LevelFormat,
  TableLayoutType,
  convertMillimetersToTwip,
} from "docx";
import { attemptCount, partStatement, grandTotalMarks, SHAPE_LINES } from "./testPaperLogic.js";

// A4 at standard margins, in twips (1440 twips = 1 inch).
const PAGE = {
  size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
  margin: {
    top: convertMillimetersToTwip(14),
    bottom: convertMillimetersToTwip(14),
    left: convertMillimetersToTwip(16),
    right: convertMillimetersToTwip(16),
  },
};
const CONTENT_WIDTH = PAGE.size.width - PAGE.margin.left - PAGE.margin.right; // ~9356 twips

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "555555" };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
// Small internal padding so text never touches a cell's border — part of
// what makes the header grid read as "complete" rather than cramped.
const CELL_MARGINS = { top: 60, bottom: 60, left: 90, right: 90 };
const HEADER_FILL = "2F2F2F";
const LABEL_FILL = "E7E7E7";

const URDU_FONT = "Jameel Noori Nastaleeq"; // falls back to a system Nastaliq/Arabic font if absent
const EN_FONT = "Cambria";

// Two font sizes, used consistently everywhere in the document (docx sizes
// are in half-points, so 22 = 11pt and 18 = 9pt):
//   MAIN_SIZE   — question text, instruction lines, option text: 11pt
//   NORMAL_SIZE — labels/values, table headers, everything secondary: 9pt
const MAIN_SIZE = 22; // 11pt
const NORMAL_SIZE = 18; // 9pt

function font(lang) {
  return lang === "ur" ? URDU_FONT : EN_FONT;
}

function run(text, { bold = false, lang = "en", size = MAIN_SIZE, color } = {}) {
  return new TextRun({ text: text ?? "", bold, font: font(lang), size, color, rightToLeft: lang === "ur" });
}

function para(children, { align, lang = "en", spacing, border } = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: align || (lang === "ur" ? AlignmentType.RIGHT : AlignmentType.LEFT),
    bidirectional: lang === "ur",
    spacing,
    border,
  });
}

function cellWidth(w) {
  return w !== undefined ? { size: Math.round(w), type: WidthType.DXA } : undefined;
}

function labelCell(text, lang, opts = {}) {
  return new TableCell({
    width: cellWidth(opts.width),
    shading: { type: ShadingType.CLEAR, fill: LABEL_FILL },
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: opts.span,
    children: [para(run(text, { bold: true, lang, size: NORMAL_SIZE }), { align: AlignmentType.CENTER, lang })],
  });
}

function valueCell(text, lang, opts = {}) {
  return new TableCell({
    width: cellWidth(opts.width),
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: opts.span,
    children: [para(run(text || " ", { lang, size: NORMAL_SIZE }), { align: AlignmentType.CENTER, lang })],
  });
}

// ---------------------------------------------------------------------
// Header: school banner (name/address/phone, mirrors the diary's header)
// plus the student/roll/class/time/marks details grid from the reference
// paper format. `layout: FIXED` (rather than Word's default auto-fit) is
// what makes every cell actually keep the width it was given, so the grid
// renders as one complete rectangle — matching the reference image —
// instead of Word quietly re-shrinking columns to fit their text.
// ---------------------------------------------------------------------
function buildHeader({ school, meta, lang, totalMarks }) {
  const w = CONTENT_WIDTH;
  const nameLine = para(run(school?.name || "", { bold: true, lang, size: 32 }), {
    align: AlignmentType.CENTER,
    lang,
  });
  const addrLine = para(run(school?.address || "", { lang, size: NORMAL_SIZE }), {
    align: AlignmentType.CENTER,
    lang,
  });
  const phoneLine = para(run(school?.phone || "", { lang, size: NORMAL_SIZE }), {
    align: AlignmentType.CENTER,
    lang,
  });

  const titleLine = meta.testName
    ? para(run(meta.testName, { bold: true, lang, size: 26 }), {
        align: AlignmentType.CENTER,
        lang,
        spacing: { before: 120, after: 120 },
      })
    : null;

  // Details grid — 6 columns, 5 rows, matching the printed template. Left
  // side is filled by the student by hand; right side is filled from the
  // teacher's form.
  const time = meta.totalTime || " ";
  const total = String(totalMarks);

  const L =
    lang === "ur"
      ? {
          studentName: "طالب علم کا نام", fatherName: "والد کا نام", rollNo: "رول نمبر",
          className: "کلاس", section: "سیکشن", time: "وقت", totalMarks: "کل نمبر",
          objMarks: "حاصل کردہ نمبر", subject: "مضمون", invigilator: "نگران",
        }
      : {
          studentName: "Student Name", fatherName: "Father Name", rollNo: "Roll No.",
          className: "Class", section: "Section", time: "Time", totalMarks: "Total Marks",
          objMarks: "Obt. Marks", subject: "Subject", invigilator: "Invigilator",
        };

  const detailsRows = [
    [labelCell(L.studentName, lang, { width: w * 0.17 }), valueCell("", lang, { width: w * 0.33 }), labelCell(L.fatherName, lang, { width: w * 0.17 }), valueCell("", lang, { width: w * 0.33 })],
    [labelCell(L.rollNo, lang, { width: w * 0.17 }), valueCell("", lang, { width: w * 0.19 }), labelCell(L.className, lang, { width: w * 0.15 }), valueCell(meta.className, lang, { width: w * 0.16 }), labelCell(L.section, lang, { width: w * 0.13 }), valueCell(meta.section, lang, { width: w * 0.20 })],
    [labelCell(L.time, lang, { width: w * 0.17 }), valueCell(time, lang, { width: w * 0.19 }), labelCell(L.totalMarks, lang, { width: w * 0.15 }), valueCell(total, lang, { width: w * 0.16 }), labelCell(L.objMarks, lang, { width: w * 0.13 }), valueCell("", lang, { width: w * 0.20 })],
    [labelCell(L.subject, lang, { width: w * 0.17 }), valueCell(meta.subject, lang, { width: w * 0.33 }), labelCell(L.invigilator, lang, { width: w * 0.17 }), valueCell("", lang, { width: w * 0.33 })],
  ];

  // Urdu template mirrors the row order right-to-left; simplest faithful
  // approach is to reverse each row's cell order so the labels still read
  // naturally right-to-left in Word.
  const rows = (lang === "ur" ? detailsRows.map((r) => [...r].reverse()) : detailsRows).map(
    (cells) => new TableRow({ children: cells, cantSplit: true })
  );

  const detailsTable = new Table({
    width: { size: w, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows,
  });

  const bits = [nameLine];
  if (school?.address) bits.push(addrLine);
  if (school?.phone) bits.push(phoneLine);
  if (titleLine) bits.push(titleLine);
  bits.push(detailsTable);
  return bits;
}

// ---------------------------------------------------------------------
// MCQ (objective) part — each question sits on its own line, and its four
// options are laid out in a compact 2x2 grid directly below it (rather
// than a No./Question/A/B/C/D row-table), matching how MCQs are normally
// set out on a printed paper.
// ---------------------------------------------------------------------
function buildMcqQuestions(subPart, lang) {
  const w = CONTENT_WIDTH;
  const optLabels = lang === "ur" ? ["الف", "ب", "ج", "د"] : ["A", "B", "C", "D"];
  const indent = 260; // twips — options sit slightly indented under their question
  const optColWidth = (w - indent) / 2;

  const nodes = [];

  subPart.questions.forEach((q, idx) => {
    nodes.push(
      new Paragraph({
        alignment: lang === "ur" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: lang === "ur",
        spacing: { before: 160, after: 60 },
        children: [
          run(`${idx + 1}. `, { bold: true, lang, size: MAIN_SIZE }),
          run(q.text, { lang, size: MAIN_SIZE }),
        ],
      })
    );

    const optCell = (label, text) =>
      new TableCell({
        width: cellWidth(optColWidth),
        borders: NO_BORDERS,
        margins: { top: 20, bottom: 20, left: 40, right: 40 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          para(
            [run(`${label}) `, { bold: true, lang, size: NORMAL_SIZE }), run(text || "", { lang, size: NORMAL_SIZE })],
            { lang }
          ),
        ],
      });

    const pairs = [
      [optLabels[0], q.options?.a],
      [optLabels[1], q.options?.b],
      [optLabels[2], q.options?.c],
      [optLabels[3], q.options?.d],
    ];
    const row1 = lang === "ur" ? [pairs[1], pairs[0]] : [pairs[0], pairs[1]];
    const row2 = lang === "ur" ? [pairs[3], pairs[2]] : [pairs[2], pairs[3]];

    nodes.push(
      new Table({
        width: { size: w - indent, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        indent: { size: indent, type: WidthType.DXA },
        rows: [
          new TableRow({ children: row1.map(([l, t]) => optCell(l, t)) }),
          new TableRow({ children: row2.map(([l, t]) => optCell(l, t)) }),
        ],
      })
    );

    if (q.shape) {
      nodes.push(
        new Paragraph({
          border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
          spacing: { before: 80, after: 60 },
          children: [new TextRun({ text: "", break: SHAPE_LINES[q.shapeSize] || 3 })],
        })
      );
    }
  });

  return nodes;
}

// ---------------------------------------------------------------------
// Written (subjective) part — a numbered list, restarting at 1 for every
// sub-part via its own numbering reference.
// ---------------------------------------------------------------------
function buildWrittenQuestions(subPart, lang, numberingRef) {
  return subPart.questions.map((q) => {
    const shapeBox = q.shape
      ? new Paragraph({
          border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
          spacing: { before: 80, after: 120 },
          children: [new TextRun({ text: "", break: SHAPE_LINES[q.shapeSize] || 3 })],
        })
      : null;
    const qPara = new Paragraph({
      numbering: { reference: numberingRef, level: 0 },
      alignment: lang === "ur" ? AlignmentType.RIGHT : AlignmentType.LEFT,
      bidirectional: lang === "ur",
      spacing: { after: 100 },
      children: [run(q.text, { lang, size: MAIN_SIZE })],
    });
    return shapeBox ? [qPara, shapeBox] : [qPara];
  }).flat();
}

function buildPartHeading(part, lang) {
  return para(run(part.title, { bold: true, lang, size: 24 }), {
    align: AlignmentType.CENTER,
    lang,
    spacing: { before: 260, after: 80 },
  });
}

function buildSubPartHeading(subPart, lang) {
  return para(run(subPart.title, { bold: true, lang, size: NORMAL_SIZE }), {
    align: lang === "ur" ? AlignmentType.RIGHT : AlignmentType.LEFT,
    lang,
    spacing: { before: 160, after: 40 },
  });
}

// Instruction line: "Q. <verb> (Any N):"   (marks x count)   /total
// laid out as a 3-cell borderless table so the marks/total sit flush right
// no matter how long the instruction text is, same as the printed original.
function buildInstructionLine(subPart, type, lang) {
  const { prefix, verb, marksExpr, total } = partStatement(subPart, type, lang);
  const w = CONTENT_WIDTH;
  const cell = (children, width, align) =>
    new TableCell({
      width: cellWidth(width),
      borders: NO_BORDERS,
      verticalAlign: VerticalAlign.CENTER,
      children: [para(children, { align, lang })],
    });

  const textChildren = [run(`${prefix} `, { bold: true, lang, size: MAIN_SIZE }), run(verb, { bold: true, lang, size: MAIN_SIZE })];
  const marksChildren = [run(marksExpr, { bold: true, lang, size: MAIN_SIZE })];
  const totalChildren = [run(`/${total}`, { bold: true, lang, size: MAIN_SIZE })];

  const cells = [
    cell(textChildren, w * 0.68, lang === "ur" ? AlignmentType.RIGHT : AlignmentType.LEFT),
    cell(marksChildren, w * 0.17, AlignmentType.CENTER),
    cell(totalChildren, w * 0.15, AlignmentType.CENTER),
  ];
  return new Table({
    width: { size: w, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: lang === "ur" ? [...cells].reverse() : cells })],
  });
}

export async function buildTestPaperDocx({ school, lang, meta, parts }) {
  const totalMarks = grandTotalMarks(parts);

  const numbering = {
    config: parts
      .filter((p) => p.type === "written")
      .flatMap((p) =>
        p.subParts.map((sp) => ({
          reference: `sub-${sp.id}`,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 460, hanging: 260 } } },
            },
          ],
        }))
      ),
  };

  const body = [];
  body.push(...buildHeader({ school, meta, lang, totalMarks }));

  for (const part of parts) {
    body.push(buildPartHeading(part, lang));

    for (const subPart of part.subParts) {
      if (subPart.title) body.push(buildSubPartHeading(subPart, lang));
      body.push(buildInstructionLine(subPart, part.type, lang));
      body.push(para(run("", { lang }), { lang, spacing: { after: 60 } }));
      if (part.type === "mcq") {
        body.push(...buildMcqQuestions(subPart, lang));
      } else {
        body.push(...buildWrittenQuestions(subPart, lang, `sub-${subPart.id}`));
      }
    }
  }

  const doc = new Document({
    numbering,
    sections: [
      {
        properties: { page: PAGE },
        children: body,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function downloadTestPaperDocx({ school, lang, meta, parts }) {
  const blob = await buildTestPaperDocx({ school, lang, meta, parts });
  const safeName = (meta.testName || "test-paper").replace(/[^\w\-]+/g, "-");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}-${meta.className || "class"}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}