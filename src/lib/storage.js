// Talks to the Express + MongoDB API in /server. Every device sees the same
// shared data, scoped per school.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...headers },
    ...rest,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------
// Schools (public)
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

// ---------------------------------------------------------------------
// Teachers (public, but always scoped to one school)
// ---------------------------------------------------------------------
export async function loadTeachers(schoolId) {
  const teachers = await request(`/api/teachers?schoolId=${schoolId}`);
  return teachers.map((t) => ({ ...t, id: t._id }));
}

export async function createTeacher(schoolId, teacher) {
  const created = await request("/api/teachers", {
    method: "POST",
    body: JSON.stringify({ ...teacher, schoolId }),
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

// ---------------------------------------------------------------------
// Dev portal — every call needs the dev password, sent as a header and
// checked server-side against the DEV_PASSWORD environment variable.
// ---------------------------------------------------------------------
export async function verifyDevPassword(password) {
  const { ok } = await request("/api/dev/verify", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return ok;
}

export async function devListSchools(devPassword) {
  const schools = await request("/api/dev/schools", {
    headers: { "x-dev-password": devPassword },
  });
  return schools.map((s) => ({ ...s, id: s._id }));
}

export async function devCreateSchool(devPassword, school) {
  const created = await request("/api/dev/schools", {
    method: "POST",
    headers: { "x-dev-password": devPassword },
    body: JSON.stringify(school),
  });
  return { ...created, id: created._id };
}

export async function devUpdateSchool(devPassword, id, school) {
  const updated = await request(`/api/dev/schools/${id}`, {
    method: "PUT",
    headers: { "x-dev-password": devPassword },
    body: JSON.stringify(school),
  });
  return { ...updated, id: updated._id };
}

export async function devDeleteSchool(devPassword, id) {
  await request(`/api/dev/schools/${id}`, {
    method: "DELETE",
    headers: { "x-dev-password": devPassword },
  });
}