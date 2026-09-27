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
const HEADER_FILL = "2F2F2F";
const LABEL_FILL = "E7E7E7";

const URDU_FONT = "Jameel Noori Nastaleeq"; // falls back to a system Nastaliq/Arabic font if absent
const EN_FONT = "Calibri";

function font(lang) {
  return lang === "ur" ? URDU_FONT : EN_FONT;
}

function run(text, { bold = false, lang = "en", size = 22, color } = {}) {
  return new TextRun({ text: text ?? "", bold, font: font(lang), size, color, rightToLeft: lang === "ur" });
}

function para(children, { align, lang = "en", spacing } = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: align || (lang === "ur" ? AlignmentType.RIGHT : AlignmentType.LEFT),
    bidirectional: lang === "ur",
    spacing,
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
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: opts.span,
    children: [para(run(text, { bold: true, lang, size: 18 }), { align: AlignmentType.CENTER, lang })],
  });
}

function valueCell(text, lang, opts = {}) {
  return new TableCell({
    width: cellWidth(opts.width),
    borders: CELL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: opts.span,
    children: [para(run(text || " ", { lang, size: 18 }), { align: AlignmentType.CENTER, lang })],
  });
}

// ---------------------------------------------------------------------
// Header: school banner (name/address/phone, mirrors the diary's header)
// plus the student/roll/class/time/marks details grid from the reference
// paper format.
// ---------------------------------------------------------------------
function buildHeader({ school, meta, lang, totalMarks }) {
  const w = CONTENT_WIDTH;
  const nameLine = para(run(school?.name || "", { bold: true, lang, size: 32 }), {
    align: AlignmentType.CENTER,
    lang,
  });
  const addrLine = para(run(school?.address || "", { lang, size: 18 }), {
    align: AlignmentType.CENTER,
    lang,
  });
  const phoneLine = para(run(school?.phone || "", { lang, size: 18 }), {
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
    [labelCell(L.studentName, lang, { width: w * 0.18 }), valueCell("", lang, { width: w * 0.32 }), labelCell(L.fatherName, lang, { width: w * 0.18 }), valueCell("", lang, { width: w * 0.32 })],
    [labelCell(L.rollNo, lang, { width: w * 0.18 }), valueCell("", lang, { width: w * 0.32 }), labelCell(L.className, lang, { width: w * 0.18 }), valueCell(meta.className, lang, { width: w * 0.16 }), labelCell(L.section, lang, { width: w * 0.08 }), valueCell(meta.section, lang, { width: w * 0.08 })],
    [labelCell(L.time, lang, { width: w * 0.18 }), valueCell(time, lang, { width: w * 0.16 }), labelCell(L.totalMarks, lang, { width: w * 0.16 }), valueCell(total, lang, { width: w * 0.16 }), labelCell(L.objMarks, lang, { width: w * 0.18 }), valueCell("", lang, { width: w * 0.16 })],
    [labelCell(L.subject, lang, { width: w * 0.18 }), valueCell(meta.subject, lang, { width: w * 0.32 }), labelCell(L.invigilator, lang, { width: w * 0.18 }), valueCell("", lang, { width: w * 0.32 })],
  ];

  // Urdu template mirrors the row order right-to-left; simplest faithful
  // approach is to reverse each row's cell order so the labels still read
  // naturally right-to-left in Word.
  const rows = (lang === "ur" ? detailsRows.map((r) => [...r].reverse()) : detailsRows).map(
    (cells) => new TableRow({ children: cells })
  );

  const detailsTable = new Table({
    width: { size: w, type: WidthType.DXA },
    rows,
  });

  const bits = [nameLine];
  if (addrLine.rootKey) bits.push(addrLine);
  bits.push(phoneLine);
  if (titleLine) bits.push(titleLine);
  bits.push(detailsTable);
  return bits;
}

// ---------------------------------------------------------------------
// MCQ (objective) part — a No./Question/A/B/C/D table, columns mirrored
// right-to-left for Urdu so "نمبر" reads on the right like the template.
// ---------------------------------------------------------------------
function buildMcqPart(part, lang) {
  const w = CONTENT_WIDTH;
  const noW = w * 0.07;
  const qW = w * 0.51;
  const optW = (w - noW - qW) / 4;

  const headersEn = ["No.", "Questions", "A", "B", "C", "D"];
  const headersUr = ["د", "ج", "ب", "الف", "سوالات", "نمبر"];
  const widthsEn = [noW, qW, optW, optW, optW, optW];
  const widthsUr = [optW, optW, optW, optW, qW, noW];

  const headers = lang === "ur" ? headersUr : headersEn;
  const widths = lang === "ur" ? widthsUr : widthsEn;

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h, i) =>
        new TableCell({
          width: cellWidth(widths[i]),
          shading: { type: ShadingType.CLEAR, fill: HEADER_FILL },
          borders: CELL_BORDERS,
          verticalAlign: VerticalAlign.CENTER,
          children: [para(run(h, { bold: true, lang, size: 18, color: "FFFFFF" }), { align: AlignmentType.CENTER, lang })],
        })
    ),
  });

  const bodyRows = part.questions.map((q, idx) => {
    const shapeExtra = q.shape
      ? [para(run("", { lang }), { lang, spacing: { before: 40 } }), ...Array.from({ length: SHAPE_LINES[q.shapeSize] || 3 }).map(() => para(run("", { lang })))]
      : [];
    const qCellChildren = [para(run(q.text, { lang, size: 18 }), { lang }), ...shapeExtra];
    const optCell = (val) =>
      new TableCell({
        borders: CELL_BORDERS,
        verticalAlign: VerticalAlign.CENTER,
        children: [para(run(val, { lang, size: 18 }), { align: AlignmentType.CENTER, lang })],
      });
    const noCell = new TableCell({
      borders: CELL_BORDERS,
      verticalAlign: VerticalAlign.CENTER,
      children: [para(run(String(idx + 1), { bold: true, lang, size: 18 }), { align: AlignmentType.CENTER, lang })],
    });
    const qCell = new TableCell({ borders: CELL_BORDERS, verticalAlign: VerticalAlign.CENTER, children: qCellChildren });

    const optsEn = [optCell(q.options?.a), optCell(q.options?.b), optCell(q.options?.c), optCell(q.options?.d)];
    const cells = lang === "ur" ? [...[...optsEn].reverse(), qCell, noCell] : [noCell, qCell, ...optsEn];
    return new TableRow({ children: cells });
  });

  return new Table({ width: { size: w, type: WidthType.DXA }, rows: [headerRow, ...bodyRows] });
}

// ---------------------------------------------------------------------
// Written (subjective) part — a numbered list, restarting at 1 for every
// part via its own numbering reference.
// ---------------------------------------------------------------------
function buildWrittenPart(part, lang, numberingRef) {
  return part.questions.map((q) => {
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
      children: [run(q.text, { lang, size: 20 })],
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

// Instruction line: "Q. <verb> (Any N):"   (marks x count)   /total
// laid out as a 3-cell borderless table so the marks/total sit flush right
// no matter how long the instruction text is, same as the printed original.
function buildInstructionLine(part, lang) {
  const { prefix, verb, marksExpr, total } = partStatement(part, lang);
  const w = CONTENT_WIDTH;
  const cell = (children, width, align) =>
    new TableCell({
      width: cellWidth(width),
      borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
      verticalAlign: VerticalAlign.CENTER,
      children: [para(children, { align, lang })],
    });

  const textChildren = [run(`${prefix} `, { bold: true, lang, size: 20 }), run(verb, { bold: true, lang, size: 20 })];
  const marksChildren = [run(marksExpr, { bold: true, lang, size: 20 })];
  const totalChildren = [run(`/${total}`, { bold: true, lang, size: 20 })];

  const cells = [
    cell(textChildren, w * 0.68, lang === "ur" ? AlignmentType.RIGHT : AlignmentType.LEFT),
    cell(marksChildren, w * 0.17, AlignmentType.CENTER),
    cell(totalChildren, w * 0.15, AlignmentType.CENTER),
  ];
  return new Table({
    width: { size: w, type: WidthType.DXA },
    rows: [new TableRow({ children: lang === "ur" ? [...cells].reverse() : cells })],
  });
}

export async function buildTestPaperDocx({ school, lang, meta, parts }) {
  const totalMarks = grandTotalMarks(parts);

  const numbering = {
    config: parts
      .filter((p) => p.type === "written")
      .map((p) => ({
        reference: `part-${p.id}`,
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 460, hanging: 260 } } },
          },
        ],
      })),
  };

  const body = [];
  body.push(...buildHeader({ school, meta, lang, totalMarks }));

  for (const part of parts) {
    body.push(buildPartHeading(part, lang));
    body.push(buildInstructionLine(part, lang));
    body.push(para(run("", { lang }), { lang, spacing: { after: 60 } }));
    if (part.type === "mcq") {
      body.push(buildMcqPart(part, lang));
    } else {
      body.push(...buildWrittenPart(part, lang, `part-${part.id}`));
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