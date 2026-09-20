// Talks to the Express + MongoDB API in /server. Every school's diary and
// admin data is scoped by its slug, so different schools never see each
// other's incharges — and the dev portal is the only place that can see or
// change a school's codes/passwords.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function withId(doc) {
  return { ...doc, id: doc._id };
}

// ---- Public: school list + info ----
export async function listSchools() {
  const schools = await request("/api/schools");
  return schools.map(withId);
}

export async function getSchool(slug) {
  return withId(await request(`/api/schools/${slug}`));
}

export async function verifySchoolCode(slug, code) {
  const { ok } = await request(`/api/schools/${slug}/verify-code`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return ok;
}

export async function verifySchoolAdminPassword(slug, password) {
  const { ok } = await request(`/api/schools/${slug}/verify-admin`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return ok;
}

// ---- Teachers, scoped to one school ----
export async function loadTeachers(slug) {
  const teachers = await request(`/api/schools/${slug}/teachers`);
  return teachers.map(withId);
}

export async function createTeacher(slug, teacher) {
  return withId(
    await request(`/api/schools/${slug}/teachers`, {
      method: "POST",
      body: JSON.stringify(teacher),
    })
  );
}

export async function updateTeacher(slug, id, teacher) {
  return withId(
    await request(`/api/schools/${slug}/teachers/${id}`, {
      method: "PUT",
      body: JSON.stringify(teacher),
    })
  );
}

export async function deleteTeacher(slug, id) {
  await request(`/api/schools/${slug}/teachers/${id}`, { method: "DELETE" });
}

export function findTeacherByName(teachers, name) {
  const target = (name || "").trim().toLowerCase();
  if (!target) return null;
  return teachers.find((t) => t.inchargeName.trim().toLowerCase() === target) || null;
}

// ---- Dev portal (manages every school, including its secrets) ----
export async function devLogin(password) {
  const { ok } = await request("/api/dev/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return ok;
}

export async function devListSchools(devPassword) {
  const schools = await request("/api/dev/schools", {
    headers: { "x-dev-password": devPassword },
  });
  return schools.map(withId);
}

export async function devCreateSchool(devPassword, school) {
  return withId(
    await request("/api/dev/schools", {
      method: "POST",
      headers: { "x-dev-password": devPassword },
      body: JSON.stringify(school),
    })
  );
}

export async function devUpdateSchool(devPassword, id, school) {
  return withId(
    await request(`/api/dev/schools/${id}`, {
      method: "PUT",
      headers: { "x-dev-password": devPassword },
      body: JSON.stringify(school),
    })
  );
}

export async function devDeleteSchool(devPassword, id) {
  await request(`/api/dev/schools/${id}`, {
    method: "DELETE",
    headers: { "x-dev-password": devPassword },
  });
}