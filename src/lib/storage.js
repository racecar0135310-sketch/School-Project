import { getAuthToken } from "./auth.js";

// Keep API calls relative by default. Vite proxies /api to the local server;
// VITE_API_URL is only needed when the API is hosted on another origin.
const API_URL = import.meta.env.VITE_API_URL || "";

function withId(record) {
  return record ? { ...record, id: record.id || record._id } : record;
}

export async function request(path, options = {}) {
  const { headers = {}, ...rest } = options;
  const token = getAuthToken();

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot reach the LMS API. Start the server with `cd server` and `npm start`, then check server/.env."
    );
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

// ---------------------------------------------------------------------
// Central authentication
// ---------------------------------------------------------------------
export function login(userId, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ userId: userId.trim(), password }),
  });
}

export function getMe() {
  return request("/api/me");
}

// ---------------------------------------------------------------------
// Schools and original diary/admin compatibility routes
// ---------------------------------------------------------------------
export function listSchools() {
  return request("/api/schools");
}

export function getSchool(schoolId) {
  return request(`/api/schools/${schoolId}`);
}

export async function verifyDiaryCode(schoolId, code) {
  const { ok } = await request(`/api/schools/${schoolId}/verify-code`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return Boolean(ok);
}

export async function verifyAdminPassword(schoolId, password) {
  const { ok } = await request(`/api/schools/${schoolId}/verify-admin`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return Boolean(ok);
}

export function updateSchoolColors(schoolId, colors) {
  return request(`/api/schools/${schoolId}/colors`, {
    method: "PUT",
    body: JSON.stringify({ colors }),
  });
}

// ---------------------------------------------------------------------
// Original teacher routes — used by the existing Diary Generator
// ---------------------------------------------------------------------
export async function loadTeachers(schoolId) {
  const teachers = await request(
    `/api/teachers?schoolId=${encodeURIComponent(schoolId)}`
  );
  return Array.isArray(teachers) ? teachers.map(withId) : [];
}

export async function createTeacher(schoolId, teacher) {
  const created = await request("/api/teachers", {
    method: "POST",
    body: JSON.stringify({ ...teacher, schoolId }),
  });
  return withId(created);
}

export async function updateTeacher(id, teacher) {
  const updated = await request(`/api/teachers/${id}`, {
    method: "PUT",
    body: JSON.stringify(teacher),
  });
  return withId(updated);
}

export async function deleteTeacher(id) {
  await request(`/api/teachers/${id}`, { method: "DELETE" });
}

export function findTeacherByName(teachers = [], name) {
  const target = String(name || "").trim().toLowerCase();
  if (!target) return null;

  return (
    teachers.find(
      (teacher) =>
        String(teacher.inchargeName || teacher.name || "")
          .trim()
          .toLowerCase() === target
    ) || null
  );
}

// ---------------------------------------------------------------------
// Hidden Dev Portal
// ---------------------------------------------------------------------
export async function verifyDevPassword(password) {
  const { ok } = await request("/api/dev/verify", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return Boolean(ok);
}

export async function devListSchools(devPassword) {
  const schools = await request("/api/dev/schools", {
    headers: { "x-dev-password": devPassword },
  });
  return Array.isArray(schools) ? schools.map(withId) : [];
}

export async function devCreateSchool(devPassword, school) {
  const created = await request("/api/dev/schools", {
    method: "POST",
    headers: { "x-dev-password": devPassword },
    body: JSON.stringify(school),
  });
  return withId(created);
}

export async function devUpdateSchool(devPassword, id, school) {
  const updated = await request(`/api/dev/schools/${id}`, {
    method: "PUT",
    headers: { "x-dev-password": devPassword },
    body: JSON.stringify(school),
  });
  return withId(updated);
}

export function devDeleteSchool(devPassword, id) {
  return request(`/api/dev/schools/${id}`, {
    method: "DELETE",
    headers: { "x-dev-password": devPassword },
  });
}

// ---------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------
export function getAdminSummary() {
  return request("/api/admin/summary");
}

export function getAdminTeachers() {
  return request("/api/admin/teachers");
}

export function addAdminTeacher(teacher) {
  return request("/api/admin/teachers", {
    method: "POST",
    body: JSON.stringify(teacher),
  });
}

export function editAdminTeacher(id, teacher) {
  return request(`/api/admin/teachers/${id}`, {
    method: "PUT",
    body: JSON.stringify(teacher),
  });
}

export function removeAdminTeacher(id) {
  return request(`/api/admin/teachers/${id}`, { method: "DELETE" });
}

export function getAdminStudents() {
  return request("/api/admin/students");
}

export function addAdminStudent(student) {
  return request("/api/admin/students", {
    method: "POST",
    body: JSON.stringify(student),
  });
}

export function editAdminStudent(id, student) {
  return request(`/api/admin/students/${id}`, {
    method: "PUT",
    body: JSON.stringify(student),
  });
}

export function removeAdminStudent(id) {
  return request(`/api/admin/students/${id}`, { method: "DELETE" });
}

export function saveAdminSettings(settings) {
  return request("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

// ---------------------------------------------------------------------
// Teacher dashboard
// ---------------------------------------------------------------------
export function getTeacherOverview() {
  return request("/api/teacher/overview");
}

export function getTeacherAttendance(date) {
  return request(`/api/teacher/attendance?date=${encodeURIComponent(date)}`);
}

export function saveTeacherAttendance(payload) {
  return request("/api/teacher/attendance", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addTeacherGrade(payload) {
  return request("/api/teacher/grades", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addTeacherHomework(payload) {
  return request("/api/teacher/homework", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addTeacherMaterial(payload) {
  return request("/api/teacher/materials", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------
// Student dashboard
// ---------------------------------------------------------------------
export function getStudentOverview() {
  return request("/api/student/overview");
}
