// Simple localStorage-backed store for teacher (incharge) records.
// Each record: { id, inchargeName, className, section, subjects: string[] }

const KEY = "school-diary-teachers";

export function loadTeachers() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTeachers(teachers) {
  localStorage.setItem(KEY, JSON.stringify(teachers));
}

export function findTeacherByName(teachers, name) {
  const target = (name || "").trim().toLowerCase();
  if (!target) return null;
  return (
    teachers.find((t) => t.inchargeName.trim().toLowerCase() === target) || null
  );
}
