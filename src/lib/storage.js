import { getAuthToken } from "./auth.js";

// Relative URLs work in Vite (the /api proxy sends them to the local server)
// and in production behind one domain. Set VITE_API_URL only when the API is
// hosted on a separate origin.
const API_URL = import.meta.env.VITE_API_URL || "";

export function normalizeId(value) {
  if (Array.isArray(value)) return value.map(normalizeId);
  if (!value || typeof value !== "object") return value;
  const normalized = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeId(child)]));
  if (normalized._id && !normalized.id) normalized.id = String(normalized._id);
  return normalized;
}

export async function request(path, options = {}) {
  const { headers, ...rest } = options;
  const token = getAuthToken();
  const method = String(rest.method || "GET").toUpperCase();
  const attempts = method === "GET" ? 3 : 1;
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        ...rest,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof body.error === "string" ? body.error : body.error?.message;
        throw new Error(message || `Request failed (${res.status})`);
      }
      return normalizeId(body?.ok === true && Object.hasOwn(body, "data") ? body.data : body);
    } catch (err) {
      lastError = err;
      if (attempt + 1 >= attempts || err instanceof Error && /^Request failed \(/.test(err.message)) break;
      await new Promise((resolve) => window.setTimeout(resolve, 250 * (2 ** attempt)));
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------
// Central login / session
// ---------------------------------------------------------------------
export async function login(userId, password, profileId) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ userId, password, ...(profileId ? { profileId } : {}) }),
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
  return request(`/api/schools/${schoolId}/verify-admin`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function updateSchoolColors(schoolId, colors, adminToken) {
  return request(`/api/schools/${schoolId}/colors`, {
    method: "PUT",
    headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
    body: JSON.stringify({ colors }),
  });
}

// ---------------------------------------------------------------------
// Original teacher routes — used by the existing Diary Generator.
// ---------------------------------------------------------------------
export async function loadTeachers(schoolId) {
  return request(`/api/teachers?schoolId=${encodeURIComponent(schoolId)}`);
}

export async function createTeacher(schoolId, teacher, adminToken) {
  const created = await request("/api/teachers", {
    method: "POST",
    headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
    body: JSON.stringify({ ...teacher, schoolId }),
  });
  return { ...created, id: created.id || created._id };
}

export async function updateTeacher(id, teacher, adminToken) {
  const updated = await request(`/api/teachers/${id}`, {
    method: "PUT",
    headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
    body: JSON.stringify(teacher),
  });
  return { ...updated, id: updated._id };
}

export async function deleteTeacher(id, adminToken) {
  await request(`/api/teachers/${id}`, { method: "DELETE", headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {} });
}

export function findTeacherByName(teachers, name) {
  const target = (name || "").trim().toLowerCase();
  if (!target) return null;
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
  return request("/api/dev/schools", { headers: { "x-dev-password": devPassword } });
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
export async function devGetFeatures(devPassword) {
  return request("/api/dev/features", { headers: { "x-dev-password": devPassword } });
}
export async function devSetFeatures(devPassword, flags, schoolId) {
  const path = schoolId ? `/api/dev/schools/${schoolId}/features` : "/api/dev/features";
  return request(path, { method: "PATCH", headers: { "x-dev-password": devPassword }, body: JSON.stringify({ flags }) });
}
export async function devSetSchoolStatus(devPassword, schoolId, status, internalNotes) {
  return request(`/api/dev/schools/${schoolId}/status`, { method: "PATCH", headers: { "x-dev-password": devPassword }, body: JSON.stringify({ status, internalNotes }) });
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
export async function adminApi(path, method = "GET", payload) {
  return request(`/api/admin/${path}`, { method, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
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
export async function getTeacherSchedule() { return request("/api/teacher/schedule"); }
export async function teacherCheckIn() { return request("/api/teacher/check-in", { method: "POST", body: JSON.stringify({ clientTime: new Date().toISOString() }) }); }
export async function teacherCheckOut() { return request("/api/teacher/check-out", { method: "POST", body: JSON.stringify({ clientTime: new Date().toISOString() }) }); }
export async function createTeacherExam(payload) { return request("/api/teacher/exams", { method: "POST", body: JSON.stringify(payload) }); }
export async function getTeacherAssignments() { return request("/api/teacher/assignments"); }
export async function gradeTeacherSubmission(id, payload) { return request(`/api/teacher/submissions/${id}/grade`, { method: "PATCH", body: JSON.stringify(payload) }); }

// ---------------------------------------------------------------------
// Student dashboard
// ---------------------------------------------------------------------
export async function getStudentOverview() {
  return request("/api/student/overview");
}
export async function submitStudentAssignment(homeworkId, payload) {
  return request(`/api/student/assignments/${homeworkId}/submissions`, { method: "POST", body: JSON.stringify(payload) });
}