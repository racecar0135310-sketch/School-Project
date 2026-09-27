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
  ImageRun,
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

// Same logos the diary falls back to when a school hasn't uploaded its own —
// keeps the test paper's header consistent with the diary even before a
// school customizes anything from the Dev Portal.
const DEFAULT_LEFT_LOGO = "/logos/minhaj-ul-quran-logo.png";
const DEFAULT_RIGHT_LOGO = "/logos/minhaj-education-society-logo.png";

// ---------------------------------------------------------------------
// Theme: font family + base size are now configurable per document (set
// from the generator's "Font" controls) instead of hard-coded. Every size
// used anywhere in the document scales off this, so bumping the base size
// enlarges headings/labels proportionally rather than just the questions.
// ---------------------------------------------------------------------
const DEFAULT_FONT_EN = "Cambria";
const DEFAULT_FONT_UR = "Jameel Noori Nastaleeq";
const DEFAULT_FONT_SIZE_PT = 11;

function buildTheme(style = {}) {
  const sizePt = Number(style.fontSize) > 0 ? Number(style.fontSize) : DEFAULT_FONT_SIZE_PT;
  const mainSize = Math.round(sizePt * 2); // half-points
  const normalSize = Math.max(12, mainSize - 4); // ~2pt smaller, floor at 6pt
  return {
    fontEn: style.fontFamilyEn || DEFAULT_FONT_EN,
    fontUr: style.fontFamilyUr || DEFAULT_FONT_UR,
    mainSize,
    normalSize,
    scale: mainSize / (DEFAULT_FONT_SIZE_PT * 2),
  };
}

function sz(basePt2, theme) {
  // basePt2 is a half-point value tuned against the default 11pt base —
  // scales it to match whatever base size the user picked.
  return Math.max(8, Math.round(basePt2 * theme.scale));
}

function font(lang, theme) {
  return lang === "ur" ? theme.fontUr : theme.fontEn;
}

// ---------------------------------------------------------------------
// Script detection: user-typed text (questions, options, instruction
// lines, meta fields) isn't guaranteed to match the paper's overall
// language — a teacher may write an English question inside an Urdu
// paper. Forcing that run/paragraph into RTL-Urdu mode is what caused the
// exported Word file to visually reorder such lines (numbers and
// punctuation jumping to the front/back). Detecting the *actual* script of
// each piece of text and using that — rather than blindly trusting the
// paper's overall language — keeps every paragraph internally consistent
// (either fully LTR or fully RTL) so Word never has to reorder runs.
// ---------------------------------------------------------------------
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
function detectLang(text, fallbackLang) {
  if (!text) return fallbackLang;
  return ARABIC_RANGE.test(text) ? "ur" : "en";
}

function run(text, { bold = false, lang = "en", size, theme, color } = {}) {
  return new TextRun({
    text: text ?? "",
    bold,
    font: font(lang, theme),
    size: size ?? theme.mainSize,
    color,
    rightToLeft: lang === "ur",
  });
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

function labelCell(text, lang, theme, opts = {}) {
  const effLang = detectLang(text, lang);
  return new TableCell({
    width: cellWidth(opts.width),
    shading: { type: ShadingType.CLEAR, fill: LABEL_FILL },
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: opts.span,
    children: [
      para(run(text, { bold: true, lang: effLang, size: theme.normalSize, theme }), {
        align: AlignmentType.CENTER,
        lang: effLang,
      }),
    ],
  });
}

function valueCell(text, lang, theme, opts = {}) {
  const effLang = detectLang(text, lang);
  return new TableCell({
    width: cellWidth(opts.width),
    borders: CELL_BORDERS,
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: opts.span,
    children: [
      para(run(text || " ", { lang: effLang, size: theme.normalSize, theme }), {
        align: AlignmentType.CENTER,
        lang: effLang,
      }),
    ],
  });
}

// ---------------------------------------------------------------------
// Logo handling — mirrors the diary: each logo sits in its own fixed box
// (object-contain style: scaled down to fit, never stretched or cropped),
// with the school name centered between them. Falls back to the same two
// default logos the diary uses when a school hasn't uploaded its own.
//
// Every logo is redrawn onto a canvas and re-exported as PNG before being
// embedded, then handed to ImageRun with an explicit `type: "png"`. Both
// of those matter: the Dev Portal accepts any image format a browser can
// decode (JPG, WEBP, even SVG), but Word's docx format only recognizes a
// fixed handful of image types — and critically, this version of the
// `docx` package silently accepts a call with no `type` at all instead of
// erroring, which produces a media file with an invalid ".undefined"
// extension that Word can't open ("Word found unreadable content...",
// forcing the "Recover" prompt). Re-encoding to PNG and always declaring
// type: "png" means every logo, whatever format it was uploaded in, is
// guaranteed to produce a file Word can actually read.
// ---------------------------------------------------------------------
function loadImageForDocx(src, maxPx = 240) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || 1;
        const naturalH = img.naturalHeight || 1;
        const scale = Math.min(1, maxPx / Math.max(naturalW, naturalH));
        const canvasW = Math.max(1, Math.round(naturalW * scale));
        const canvasH = Math.max(1, Math.round(naturalH * scale));
        const canvas = document.createElement("canvas");
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.drawImage(img, 0, 0, canvasW, canvasH);
        canvas.toBlob((blob) => {
          if (!blob) return resolve(null);
          blob
            .arrayBuffer()
            .then((buffer) => resolve({ buffer, width: canvasW, height: canvasH }))
            .catch(() => resolve(null));
        }, "image/png");
      } catch (err) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function buildLogoParagraph(src, boxPx) {
  const image = await loadImageForDocx(src, boxPx * 3);
  if (!image) return new Paragraph({ children: [] });
  const ratio = Math.min(boxPx / image.width, boxPx / image.height, 1) || 1;
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: "png", data: image.buffer, transformation: { width, height } })],
  });
}

// ---------------------------------------------------------------------
// Header: logo banner (left logo / school name & address / right logo —
// same layout as the diary) plus the student/roll/class/time/marks details
// grid from the reference paper format. `layout: FIXED` (rather than
// Word's default auto-fit) is what makes every cell actually keep the
// width it was given, so the grid renders as one complete rectangle —
// matching the reference image — instead of Word quietly re-shrinking
// columns to fit their text. The Father Name and Invigilator boxes are
// intentionally given more width than their labels so they read as full,
// generously-sized rectangles for someone to write in.
// ---------------------------------------------------------------------
async function buildHeader({ school, meta, lang, totalMarks, theme }) {
  const w = CONTENT_WIDTH;

  const nameLang = detectLang(school?.name, lang);
  const addrLang = detectLang(school?.address, lang);
  const phoneLang = detectLang(school?.phone, lang);
  const nameLine = para(run(school?.name || "", { bold: true, lang: nameLang, size: sz(32, theme), theme }), {
    align: AlignmentType.CENTER,
    lang: nameLang,
  });
  const addrLine = para(run(school?.address || "", { lang: addrLang, size: theme.normalSize, theme }), {
    align: AlignmentType.CENTER,
    lang: addrLang,
  });
  const phoneLine = para(run(school?.phone || "", { lang: phoneLang, size: theme.normalSize, theme }), {
    align: AlignmentType.CENTER,
    lang: phoneLang,
  });

  const titleLang = detectLang(meta.testName, lang);
  const titleLine = meta.testName
    ? para(run(meta.testName, { bold: true, lang: titleLang, size: sz(26, theme), theme }), {
        align: AlignmentType.CENTER,
        lang: titleLang,
        spacing: { before: 120, after: 120 },
      })
    : null;

  // Details grid — 6 columns, 5 rows, matching the printed template. Left
  // side is filled by the student by hand; right side is filled from the
  // teacher's form. Father Name and Invigilator get a noticeably wider
  // value box than the others (0.45 vs the usual 0.33 of the row) since
  // those are always hand-filled and benefit from the extra writing room.
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

  const lc = (text, opts) => labelCell(text, lang, theme, opts);
  const vc = (text, opts) => valueCell(text, lang, theme, opts);

  const detailsRows = [
    [
      lc(L.studentName, { width: w * 0.15 }),
      vc("", { width: w * 0.28 }),
      lc(L.fatherName, { width: w * 0.12 }),
      vc("", { width: w * 0.45 }),
    ],
    [
      lc(L.rollNo, { width: w * 0.17 }),
      vc("", { width: w * 0.19 }),
      lc(L.className, { width: w * 0.15 }),
      vc(meta.className, { width: w * 0.16 }),
      lc(L.section, { width: w * 0.13 }),
      vc(meta.section, { width: w * 0.20 }),
    ],
    [
      lc(L.time, { width: w * 0.17 }),
      vc(time, { width: w * 0.19 }),
      lc(L.totalMarks, { width: w * 0.15 }),
      vc(total, { width: w * 0.16 }),
      lc(L.objMarks, { width: w * 0.13 }),
      vc("", { width: w * 0.20 }),
    ],
    [
      lc(L.subject, { width: w * 0.15 }),
      vc(meta.subject, { width: w * 0.28 }),
      lc(L.invigilator, { width: w * 0.12 }),
      vc("", { width: w * 0.45 }),
    ],
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

  // Logo banner — left logo / school name block / right logo, same layout
  // the diary uses. Falls back to the diary's default logos when a school
  // hasn't uploaded its own.
  const LOGO_BOX_PX = 60;
  const LOGO_COL_TWIPS = 1250;
  const [leftLogoPara, rightLogoPara] = await Promise.all([
    buildLogoParagraph(school?.leftLogo || DEFAULT_LEFT_LOGO, LOGO_BOX_PX),
    buildLogoParagraph(school?.rightLogo || DEFAULT_RIGHT_LOGO, LOGO_BOX_PX),
  ]);

  const logoCell = (paragraph) =>
    new TableCell({
      width: cellWidth(LOGO_COL_TWIPS),
      borders: NO_BORDERS,
      verticalAlign: VerticalAlign.CENTER,
      children: [paragraph],
    });

  const nameCell = new TableCell({
    width: cellWidth(w - LOGO_COL_TWIPS * 2),
    borders: NO_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    children: [nameLine, ...(school?.address ? [addrLine] : []), ...(school?.phone ? [phoneLine] : [])],
  });

  const bannerTable = new Table({
    width: { size: w, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: [logoCell(leftLogoPara), nameCell, logoCell(rightLogoPara)] })],
  });

  const bits = [bannerTable];
  if (titleLine) bits.push(titleLine);
  bits.push(detailsTable);
  return bits;
}

// ---------------------------------------------------------------------
// MCQ (objective) part — each question sits on its own line, and its four
// options are laid out in a compact 2x2 grid directly below it (rather
// than a No./Question/A/B/C/D row-table), matching how MCQs are normally
// set out on a printed paper. Each question's own language (not the
// paper's) decides its alignment/direction/option-labels, so an English
// question inside an Urdu paper (or vice versa) reads correctly instead of
// having its words and numbering reordered.
// ---------------------------------------------------------------------
function buildMcqQuestions(subPart, lang, theme) {
  const w = CONTENT_WIDTH;
  const indent = 260; // twips — options sit slightly indented under their question

  const nodes = [];

  subPart.questions.forEach((q, idx) => {
    const qLang = detectLang(q.text, lang);
    const optLabels = qLang === "ur" ? ["الف", "ب", "ج", "د"] : ["A", "B", "C", "D"];
    const optColWidth = (w - indent) / 2;

    nodes.push(
      new Paragraph({
        alignment: qLang === "ur" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: qLang === "ur",
        spacing: { before: 160, after: 60 },
        children: [
          run(`${idx + 1}. `, { bold: true, lang: qLang, size: theme.mainSize, theme }),
          run(q.text, { lang: qLang, size: theme.mainSize, theme }),
        ],
      })
    );

    const optCell = (label, text) => {
      const optLang = detectLang(text, qLang);
      return new TableCell({
        width: cellWidth(optColWidth),
        borders: NO_BORDERS,
        margins: { top: 20, bottom: 20, left: 40, right: 40 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          para(
            [
              run(`${label}) `, { bold: true, lang: optLang, size: theme.normalSize, theme }),
              run(text || "", { lang: optLang, size: theme.normalSize, theme }),
            ],
            { lang: optLang }
          ),
        ],
      });
    };

    const pairs = [
      [optLabels[0], q.options?.a],
      [optLabels[1], q.options?.b],
      [optLabels[2], q.options?.c],
      [optLabels[3], q.options?.d],
    ];
    const row1 = qLang === "ur" ? [pairs[1], pairs[0]] : [pairs[0], pairs[1]];
    const row2 = qLang === "ur" ? [pairs[3], pairs[2]] : [pairs[2], pairs[3]];

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
// sub-part via its own numbering reference. Each question's own detected
// language decides its paragraph direction, same reasoning as the MCQs.
// ---------------------------------------------------------------------
function buildWrittenQuestions(subPart, lang, theme, numberingRef) {
  return subPart.questions
    .map((q) => {
      const qLang = detectLang(q.text, lang);
      const shapeBox = q.shape
        ? new Paragraph({
            border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
            spacing: { before: 80, after: 120 },
            children: [new TextRun({ text: "", break: SHAPE_LINES[q.shapeSize] || 3 })],
          })
        : null;
      const qPara = new Paragraph({
        numbering: { reference: numberingRef, level: 0 },
        alignment: qLang === "ur" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: qLang === "ur",
        spacing: { after: 100 },
        children: [run(q.text, { lang: qLang, size: theme.mainSize, theme })],
      });
      return shapeBox ? [qPara, shapeBox] : [qPara];
    })
    .flat();
}

function buildPartHeading(part, lang, theme) {
  const effLang = detectLang(part.title, lang);
  return para(run(part.title, { bold: true, lang: effLang, size: sz(24, theme), theme }), {
    align: AlignmentType.CENTER,
    lang: effLang,
    spacing: { before: 260, after: 80 },
  });
}

function buildSubPartHeading(subPart, lang, theme) {
  const effLang = detectLang(subPart.title, lang);
  return para(run(subPart.title, { bold: true, lang: effLang, size: theme.normalSize, theme }), {
    align: effLang === "ur" ? AlignmentType.RIGHT : AlignmentType.LEFT,
    lang: effLang,
    spacing: { before: 160, after: 40 },
  });
}

// Instruction line: "Q. <verb> (Any N):"   (marks x count)   /total
// laid out as a 3-cell borderless table so the marks/total sit flush right
// no matter how long the instruction text is, same as the printed original.
// The verb's own detected language (not just the paper's) picks the font
// and direction for that run, so an English instruction typed into an
// Urdu paper doesn't get forced into Urdu-RTL rendering.
function buildInstructionLine(subPart, type, lang, theme) {
  const { prefix, verb, marksExpr, total } = partStatement(subPart, type, lang);
  const verbLang = detectLang(verb, lang);
  const w = CONTENT_WIDTH;
  const cell = (children, width, align) =>
    new TableCell({
      width: cellWidth(width),
      borders: NO_BORDERS,
      verticalAlign: VerticalAlign.CENTER,
      children: [para(children, { align, lang: verbLang })],
    });

  const textChildren = [
    run(`${prefix} `, { bold: true, lang: verbLang, size: theme.mainSize, theme }),
    run(verb, { bold: true, lang: verbLang, size: theme.mainSize, theme }),
  ];
  const marksChildren = [run(marksExpr, { bold: true, lang: verbLang, size: theme.mainSize, theme })];
  const totalChildren = [run(`/${total}`, { bold: true, lang: verbLang, size: theme.mainSize, theme })];

  const cells = [
    cell(textChildren, w * 0.68, verbLang === "ur" ? AlignmentType.RIGHT : AlignmentType.LEFT),
    cell(marksChildren, w * 0.17, AlignmentType.CENTER),
    cell(totalChildren, w * 0.15, AlignmentType.CENTER),
  ];
  return new Table({
    width: { size: w, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: lang === "ur" ? [...cells].reverse() : cells })],
  });
}

export async function buildTestPaperDocx({ school, lang, meta, parts, style }) {
  const theme = buildTheme(style);
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
  body.push(...(await buildHeader({ school, meta, lang, totalMarks, theme })));

  for (const part of parts) {
    body.push(buildPartHeading(part, lang, theme));

    for (const subPart of part.subParts) {
      if (subPart.title) body.push(buildSubPartHeading(subPart, lang, theme));
      body.push(buildInstructionLine(subPart, part.type, lang, theme));
      body.push(para(run("", { lang, theme }), { lang, spacing: { after: 60 } }));
      if (part.type === "mcq") {
        body.push(...buildMcqQuestions(subPart, lang, theme));
      } else {
        body.push(...buildWrittenQuestions(subPart, lang, theme, `sub-${subPart.id}`));
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

export async function downloadTestPaperDocx({ school, lang, meta, parts, style }) {
  const blob = await buildTestPaperDocx({ school, lang, meta, parts, style });
  const safeName = (meta.testName || "test-paper").replace(/[^\w\-]+/g, "-");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}-${meta.className || "class"}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}