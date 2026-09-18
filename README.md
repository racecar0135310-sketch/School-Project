# School Homework Diary Generator

A small React + Tailwind app. The teacher fills in the class/date details and
adds one row per subject (subject name + homework text), clicks
**"Done — Save as Image"**, and a PNG of the diary (in the school's printed
format) downloads automatically. Everything runs in the browser — no backend
or database needed, Node is only used to run the dev server / build.

## 1. Install prerequisites
You need **Node.js 18+** installed (https://nodejs.org). Check with:
```
node -v
npm -v
```

## 2. Install dependencies
Unzip the project, then in a terminal:
```
cd school-diary-app
npm install
```

## 3. Run it locally
```
npm run dev
```
Open the URL it prints (usually http://localhost:5173).

## 4. Build for deployment (e.g. Netlify)
```
npm run build
```
This creates a `dist/` folder — same as your other Netlify project, drag
that `dist` folder into Netlify, or connect the Git repo and set:
- Build command: `npm run build`
- Publish directory: `dist`

## How it works
- `src/App.jsx` has the form (left) and a live preview of the diary (right)
  that updates as you type.
- Clicking "Done — Save as Image" uses the `html2canvas` library to turn the
  preview `<div>` into a PNG and triggers a download — no server round trip.
- The header, Bismillah line, and the two Durood lines at the bottom are
  fixed template text (same every time), matching the printed diary. Class,
  section, date, day, incharge, subjects and note are all editable.

## Customizing
- School name/address/phone and the fixed Arabic lines are constants near
  the top of `src/App.jsx` — edit them once if needed.
- To add a real school crest/logo, replace the two placeholder circles in
  `DiaryPreview` with `<img src="/logo.png" ... />` (put the image in a
  `public/` folder).
- Colors/spacing use Tailwind utility classes, so you can restyle freely.
