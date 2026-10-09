import { getAuthToken } from "./auth.js";

// Relative URLs work in Vite (the /api proxy sends them to the local server)
// and in production behind one domain. Set VITE_API_URL only when the API is
// hosted on a separate origin.
const API_URL = import.meta.env.VITE_API_URL || "";

export async function request(path, options = {}) {
  const { headers, ...rest } = options;
  const token = getAuthToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...rest,
  });
   const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

// ---------------------------------------------------------------------
// Central login / session
// ---------------------------------------------------------------------
export async function login(userId, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ userId, password }),
  });
}

export async function getMe() {
  return request("/api/me");
}

// ---------------------------------------------------------------------
// Schools and the original diary/admin compatibility routes
// ---------------------------------------------------------------------
export async function listSchools() {
  return request("/api/schools");
}

export async function getSchool(schoolId) {
  return request(`/api/schools/${schoolId}`);
}

export async function verifyDiaryCode(schoolId, code) {
  const { ok } = await request(`/api/schools/${schoolId}/verify-code`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return ok;
}

export async function verifyAdminPassword(schoolId, password) {
  const { ok } = await request(`/api/schools/${schoolId}/verify-admin`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return ok;
}

export async function updateSchoolColors(schoolId, colors) {
  return request(`/api/schools/${schoolId}/colors`, {
    method: "PUT",
    body: JSON.stringify({ colors }),
  });
}

// ---------------------------------------------------------------------
// Original teacher routes — used by the existing Diary Generator.
// ---------------------------------------------------------------------
export async function loadTeachers(schoolId) {
    const teachers = await request(`/api/teachers?schoolId=${encodeURIComponent(schoolId)}`);
  return teachers.map((t) => ({ ...t, id: t.id || t._id }));

}

export async function createTeacher(schoolId, teacher) {
  const created = await request("/api/teachers", {
    method: "POST",
    body: JSON.stringify({ ...teacher, schoolId }),
  });
  return { ...updated, id: updated.id || updated._id };
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
  return (
    teachers.find((t) => t.inchargeName.trim().toLowerCase() === target) ||
    null
  );
   return teachers.find((teacher) => (teacher.inchargeName || "").trim().toLowerCase() === target) || null;
}

// ---------------------------------------------------------------------
// Hidden Dev Portal
// ---------------------------------------------------------------------
export async function verifyDevPassword(password) {
  const { ok } = await request("/api/dev/verify", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return ok;
}

export async function devListSchools(devPassword) {
    const schools = await request("/api/dev/schools", { headers: { "x-dev-password": devPassword } });
  return schools.map((s) => ({ ...s, id: s.id || s._id }));

}

export async function devCreateSchool(devPassword, school) {
  const created = await request("/api/dev/schools", {
    method: "POST",
    headers: { "x-dev-password": devPassword },
    body: JSON.stringify(school),
  });
  return { ...created, id: created.id || created._id };
}

export async function devUpdateSchool(devPassword, id, school) {
  const updated = await request(`/api/dev/schools/${id}`, {
    method: "PUT",
    headers: { "x-dev-password": devPassword },
    body: JSON.stringify(school),
  });
  return { ...updated, id: updated.id || updated._id };
}

export async function devDeleteSchool(devPassword, id) {
  await request(`/api/dev/schools/${id}`, {
    method: "DELETE",
    headers: { "x-dev-password": devPassword },
  });
}

// ---------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------
export async function getAdminSummary() {
  return request("/api/admin/summary");
}
export async function getAdminTeachers() {
  return request("/api/admin/teachers");
}
export async function addAdminTeacher(teacher) {
  return request("/api/admin/teachers", { method: "POST", body: JSON.stringify(teacher) });
}
export async function editAdminTeacher(id, teacher) {
  return request(`/api/admin/teachers/${id}`, { method: "PUT", body: JSON.stringify(teacher) });
}
export async function removeAdminTeacher(id) {
  return request(`/api/admin/teachers/${id}`, { method: "DELETE" });
}
export async function getAdminStudents() {
  return request("/api/admin/students");
}
export async function addAdminStudent(student) {
  return request("/api/admin/students", { method: "POST", body: JSON.stringify(student) });
}
export async function editAdminStudent(id, student) {
  return request(`/api/admin/students/${id}`, { method: "PUT", body: JSON.stringify(student) });
}
export async function removeAdminStudent(id) {
  return request(`/api/admin/students/${id}`, { method: "DELETE" });
}
export async function saveAdminSettings(settings) {
  return request("/api/admin/settings", { method: "PUT", body: JSON.stringify(settings) });
}

// ---------------------------------------------------------------------
// Teacher dashboard
// ---------------------------------------------------------------------
export async function getTeacherOverview() {
  return request("/api/teacher/overview");
}
export async function getTeacherAttendance(date) {
  return request(`/api/teacher/attendance?date=${encodeURIComponent(date)}`);
}
export async function saveTeacherAttendance(payload) {
  return request("/api/teacher/attendance", { method: "POST", body: JSON.stringify(payload) });
}
export async function addTeacherGrade(payload) {
  return request("/api/teacher/grades", { method: "POST", body: JSON.stringify(payload) });
}
export async function addTeacherHomework(payload) {
  return request("/api/teacher/homework", { method: "POST", body: JSON.stringify(payload) });
}
export async function addTeacherMaterial(payload) {
  return request("/api/teacher/materials", { method: "POST", body: JSON.stringify(payload) });
}

// ---------------------------------------------------------------------
// Student dashboard
// ---------------------------------------------------------------------
export async function getStudentOverview() {
  return request("/api/student/overview");
}