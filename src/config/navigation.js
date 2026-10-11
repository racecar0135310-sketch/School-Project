export const NAV_BY_ROLE = {
  admin: [
    ["overview", "Overview", "⌂"],
    ["teachers", "Teachers", "♙"],
    ["students", "Students", "♧"],
    ["attendance", "Attendance review", "✓"],
    ["staff-attendance", "Teacher attendance", "◷"],
    ["classes", "Classes & subjects", "▦"],
    ["timetable", "Timetable", "◷"],
    ["calendar", "Calendar", "▣"],
    ["exams", "Exams", "✎"],
    ["fees", "Fees", "$"],
    ["reports", "Reports", "▤"],
    ["import", "Import students", "⇧"],
    ["audit", "Activity log", "⌁"],
    ["settings", "School settings", "⚙"],
  ],
  teacher: [
    ["overview", "Overview", "⌂"],
    ["attendance", "Attendance", "✓"],
    ["gradebook", "Gradebook", "▤"],
    ["homework", "Homework", "⌁"],
    ["materials", "Study material", "▣"],
    ["schedule", "Schedule & exams", "◷"],
    ["submissions", "Submissions", "✓"],
    ["generators", "Generators", "✦"],
  ],
  student: [
    ["overview", "My dashboard", "⌂"],
    ["diary", "Diary & homework", "⌁"],
    ["attendance", "My attendance", "✓"],
    ["tests", "Tests", "▣"],
    ["results", "Results", "▤"],
    ["timetable", "Timetable & calendar", "◷"],
    ["fees", "My fees", "$"],
  ],
};

const FEATURE_FOR_VIEW = {
  attendance: "attendance", "staff-attendance": "attendance", gradebook: "gradebook",
  homework: "homework", submissions: "homework", materials: "materials",
  exams: "exams", fees: "fees", reports: "reports", import: "import",
  timetable: "timetable", calendar: "calendar", generators: "diary",
};

export function allowedViews(role, features) {
  return (NAV_BY_ROLE[role] || []).filter(([view]) => !features || !FEATURE_FOR_VIEW[view] || features[FEATURE_FOR_VIEW[view]] !== false).map(([view]) => view);
}

export function roleAllowsView(role, view, features) {
  return allowedViews(role, features).includes(view);
}
