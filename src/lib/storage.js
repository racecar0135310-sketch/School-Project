// This used to read/write localStorage directly, which only ever worked on
// one browser on one device. It now talks to the small Express + MongoDB
// API in /server, so every device sees the same shared list of incharges.
//
// Set VITE_API_URL (at build time) to your deployed API's base URL, e.g.
// https://school-diary-api.onrender.com — see the README for details.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// Fetch every teacher from the shared database. Each record's Mongo _id is
// exposed as `id` so the rest of the app doesn't need to know about Mongo.
export async function loadTeachers() {
  const teachers = await request("/api/teachers");
  return teachers.map((t) => ({ ...t, id: t._id }));
}

export async function createTeacher(teacher) {
  const created = await request("/api/teachers", {
    method: "POST",
    body: JSON.stringify(teacher),
  });
  return { ...created, id: created._id };
}

export async function updateTeacher(id, teacher) {
  const updated = await request(`/api/teachers/${id}`, {
    method: "PUT",
    body: JSON.stringify(teacher),
  });
  return { ...updated, id: updated._id };
}

export async function deleteTeacher(id) {
  await request(`/api/teachers/${id}`, { method: "DELETE" });
}

export function findTeacherByName(teachers, name) {
  const target = (name || "").trim().toLowerCase();
  if (!target) return null;
  return (
    teachers.find((t) => t.inchargeName.trim().toLowerCase() === target) ||
    null
  );
}