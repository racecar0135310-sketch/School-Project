import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Teacher from "./Teacher.js";
import Student from "./Student.js";
import User from "./User.js";
import Attendance from "./Attendance.js";
import Grade from "./Grade.js";
import Homework from "./Homework.js";
import Material from "./Material.js";
import School from "./School.js";

const app = express();
app.use(cors());
// Diary logos and optional learning-material uploads are sent as data URLs.
app.use(express.json({ limit: "12mb" }));

const {
  MONGODB_URI,
  PORT = 4000,
  DEV_PASSWORD,
  AUTH_SECRET = "change-this-auth-secret-before-production",
} = process.env;

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI environment variable.");
  process.exit(1);
}

if (!DEV_PASSWORD) {
  console.error("Missing DEV_PASSWORD environment variable.");
  process.exit(1);
}

const DEFAULT_TEACHER_PASSWORD = "teacher123";
const DEFAULT_STUDENT_PASSWORD = "student123";

// ---------------------------------------------------------------------
// Small security and serialization helpers
// ---------------------------------------------------------------------
function normalizeId(value) {
  return String(value || "").trim().toLowerCase();
}

function slugify(value) {
  return normalizeId(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36) || "school";
}

function passwordHash(secret) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(secret), salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifySecret(secret, hash, legacyValue = "") {
  if (!secret) return false;
  if (!hash) return String(secret) === String(legacyValue || "");
  const [salt, expected] = String(hash).split(":");
  if (!salt || !expected) return false;
  try {
    const actual = crypto.scryptSync(String(secret), salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function base64Url(value) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(value) {
  return Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function createSession(payload) {
  const body = base64Url(JSON.stringify({ ...payload, exp: Date.now() + 12 * 60 * 60 * 1000 }));
  const signature = base64Url(crypto.createHmac("sha256", AUTH_SECRET).update(body).digest());
  return `${body}.${signature}`;
}

function readSession(token) {
  try {
    const [body, signature] = String(token || "").split(".");
    if (!body || !signature) return null;
    const expected = base64Url(crypto.createHmac("sha256", AUTH_SECRET).update(body).digest());
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
    const payload = JSON.parse(fromBase64Url(body));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const session = readSession(token);
  if (!session) return res.status(401).json({ error: "Your session has expired. Please log in again." });
  req.user = session;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: "You do not have access to this area." });
    next();
  };
}

// Express 4 does not automatically forward rejected async route promises.
// Keep the dashboard routes JSON-safe if MongoDB rejects a query.
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function idOf(value) {
  return value?._id?.toString?.() || value?.toString?.() || value;
}

function publicSchool(s) {
  return {
    id: idOf(s._id),
    name: s.name,
    address: s.address || "",
    phone: s.phone || "",
    colors: s.colors,
    leftLogo: s.leftLogo || "",
    rightLogo: s.rightLogo || "",
  };
}

function publicTeacher(t) {
  return {
    id: idOf(t._id),
    _id: idOf(t._id),
    userId: t.userId || "",
    inchargeName: t.inchargeName,
    name: t.inchargeName,
    className: t.className || "",
    section: t.section || "",
    subjects: Array.isArray(t.subjects) ? t.subjects : [],
    active: t.active !== false,
  };
}

function publicStudent(s) {
  return {
    id: idOf(s._id),
    _id: idOf(s._id),
    userId: s.userId,
    name: s.name,
    className: s.className || "",
    section: s.section || "",
    rollNumber: s.rollNumber || "",
    parentName: s.parentName || "",
    parentPhone: s.parentPhone || "",
    active: s.active !== false,
  };
}

function publicHomework(item) {
  const json = item.toObject ? item.toObject() : item;
  return {
    ...json,
    id: idOf(json._id),
    schoolId: idOf(json.schoolId),
    teacherId: idOf(json.teacherId),
    attachmentData: json.attachmentData || "",
  };
}

function publicMaterial(item) {
  const json = item.toObject ? item.toObject() : item;
  return {
    ...json,
    id: idOf(json._id),
    schoolId: idOf(json.schoolId),
    teacherId: idOf(json.teacherId),
    fileData: json.fileData || "",
  };
}

function publicGrade(item) {
  const json = item.toObject ? item.toObject() : item;
  return { ...json, id: idOf(json._id), studentId: idOf(json.studentId), teacherId: idOf(json.teacherId) };
}

function publicAttendance(item) {
  if (!item) return null;
  const json = item.toObject ? item.toObject() : item;
  return {
    ...json,
    id: idOf(json._id),
    teacherId: idOf(json.teacherId),
    records: (json.records || []).map((record) => ({ ...record, studentId: idOf(record.studentId) })),
  };
}

async function uniqueUserId(preferred, fallback) {
  const base = slugify(preferred || fallback);
  let candidate = base;
  let suffix = 2;
  while (await User.exists({ userId: candidate })) candidate = `${base}-${suffix++}`;
  return candidate;
}

async function schoolById(schoolId) {
  return School.findById(schoolId);
}

async function teacherForSession(req) {
  if (req.user.role !== "teacher") return null;
  const query = req.user.profileId
    ? { _id: req.user.profileId, schoolId: req.user.schoolId }
    : { userId: req.user.userId, schoolId: req.user.schoolId };
  return Teacher.findOne(query);
}

async function studentForSession(req) {
  if (req.user.role !== "student") return null;
  const query = req.user.profileId
    ? { _id: req.user.profileId, schoolId: req.user.schoolId }
    : { userId: req.user.userId, schoolId: req.user.schoolId };
  return Student.findOne(query);
}

function classScope(teacher, requestedClass, requestedSection) {
  return {
    className: teacher?.className || String(requestedClass || "").trim(),
    section: teacher?.section || String(requestedSection || "").trim(),
  };
}

async function loginAccount(userId, password) {
  const normalized = normalizeId(userId);
  if (!normalized || !password) return null;

  let account = await User.findOne({ userId: normalized, active: true });
  let school;
  let role;
  let profile;

  if (account) {
    school = await School.findById(account.schoolId);
    role = account.role;
    if (role === "admin") {
      profile = null;
    } else if (role === "teacher") {
      profile = await Teacher.findById(account.profileId);
    } else {
      profile = await Student.findById(account.profileId);
    }
  } else {
    // Compatibility for schools and teacher rows created before the central
    // account directory existed.
    school = await School.findOne({ adminUserId: normalized });
    if (school) {
      role = "admin";
    } else {
      profile = await Teacher.findOne({ userId: normalized, active: true });
      if (profile) {
        school = await School.findById(profile.schoolId);
        role = "teacher";
      } else {
        profile = await Student.findOne({ userId: normalized, active: true });
        if (profile) {
          school = await School.findById(profile.schoolId);
          role = "student";
        }
      }
    }
  }

  if (!school || !role) return null;

  const valid =
    role === "admin"
      ? verifySecret(password, school.adminPasswordHash, school.adminPassword)
      : role === "teacher"
        ? verifySecret(password, school.teacherPasswordHash, DEFAULT_TEACHER_PASSWORD)
        : verifySecret(password, school.studentPasswordHash, DEFAULT_STUDENT_PASSWORD);
  if (!valid) return null;

  const user = {
    id: account ? idOf(account._id) : idOf(profile?._id || school._id),
    userId: normalized,
    role,
    name: account?.name || (role === "admin" ? `${school.name} Admin` : profile?.name || profile?.inchargeName || normalized),
    schoolId: idOf(school._id),
    ...(role === "teacher" ? { className: profile?.className || "", section: profile?.section || "", subjects: profile?.subjects || [] } : {}),
    ...(role === "student" ? { className: profile?.className || "", section: profile?.section || "", rollNumber: profile?.rollNumber || "" } : {}),
  };
  const token = createSession({
    sub: user.id,
    userId: user.userId,
    role,
    name: user.name,
    schoolId: user.schoolId,
    profileId: profile ? idOf(profile._id) : null,
  });
  return { token, user, school: publicSchool(school) };
}

// ---------------------------------------------------------------------
// Database connection and health
// ---------------------------------------------------------------------
mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB");
    for (const model of [School, Teacher, Student, User, Attendance, Grade, Homework, Material]) {
      try {
        await model.syncIndexes();
      } catch (err) {
        console.error(`Failed to sync ${model.modelName} indexes:`, err.message);
      }
    }
    console.log("Indexes synced");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------
// Central authentication. The frontend sends only a user ID and password;
// the server finds the school and role from the account directory.
// ---------------------------------------------------------------------
app.post("/api/auth/login", async (req, res) => {
  try {
    const result = await loginAccount(req.body.userId, req.body.password);
    if (!result) return res.status(401).json({ error: "Incorrect ID or password." });
    res.json(result);
  } catch (err) {
    console.error("Login failed:", err);
    res.status(500).json({ error: "Unable to sign in right now." });
  }
});

app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const school = await schoolById(req.user.schoolId);
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json({ user: req.user, school: publicSchool(school) });
  } catch {
    res.status(500).json({ error: "Unable to load your account." });
  }
});

// ---------------------------------------------------------------------
// Dev portal — kept separate from normal login and hidden behind its own
// password. It creates the first admin account for each school.
// ---------------------------------------------------------------------
function requireDevAuth(req, res, next) {
  if (req.header("x-dev-password") !== DEV_PASSWORD) return res.status(401).json({ error: "Invalid dev password." });
  next();
}

app.post("/api/dev/verify", (req, res) => res.json({ ok: req.body.password === DEV_PASSWORD }));

function devSchoolView(s) {
  const raw = s.toObject();
  // Never send password hashes to the browser, even to the hidden portal.
  delete raw.adminPasswordHash;
  delete raw.teacherPasswordHash;
  delete raw.studentPasswordHash;
  return {
    ...raw,
    _id: idOf(s._id),
    id: idOf(s._id),
    adminUserId: s.adminUserId || `${slugify(s.name)}-admin`,
    teacherPasswordConfigured: Boolean(s.teacherPasswordHash),
    studentPasswordConfigured: Boolean(s.studentPasswordHash),
  };
}

app.get("/api/dev/schools", requireDevAuth, async (req, res) => {
  try {
    const schools = await School.find().sort({ name: 1 });
    res.json(schools.map(devSchoolView));
  } catch {
    res.status(500).json({ error: "Failed to load schools." });
  }
});

app.post("/api/dev/schools", requireDevAuth, async (req, res) => {
  try {
    const { name, address, phone, diaryCode, adminPassword, adminUserId, teacherPassword, studentPassword, leftLogo, rightLogo } = req.body;
    if (!name?.trim() || !diaryCode?.trim() || !adminPassword?.trim()) {
      return res.status(400).json({ error: "School name, diary code and admin password are required." });
    }
    const cleanAdminId = await uniqueUserId(adminUserId, `${name}-admin`);
    const school = await School.create({
      name: name.trim(),
      address: (address || "").trim(),
      phone: (phone || "").trim(),
      diaryCode: diaryCode.trim(),
      adminPassword: adminPassword.trim(),
      adminUserId: cleanAdminId,
      adminPasswordHash: passwordHash(adminPassword),
      teacherPasswordHash: passwordHash(teacherPassword?.trim() || DEFAULT_TEACHER_PASSWORD),
      studentPasswordHash: passwordHash(studentPassword?.trim() || DEFAULT_STUDENT_PASSWORD),
      leftLogo: leftLogo || "",
      rightLogo: rightLogo || "",
    });
    try {
      await User.create({ schoolId: school._id, userId: cleanAdminId, role: "admin", name: `${school.name} Admin` });
    } catch (err) {
      await School.findByIdAndDelete(school._id);
      throw err;
    }
    res.status(201).json(devSchoolView(school));
  } catch (err) {
    console.error("POST /api/dev/schools failed:", err);
    if (err.code === 11000) return res.status(409).json({ error: "That login ID or school value is already in use." });
    res.status(500).json({ error: "Failed to create school." });
  }
});

app.put("/api/dev/schools/:id", requireDevAuth, async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ error: "School not found." });
    const { name, address, phone, diaryCode, adminPassword, adminUserId, teacherPassword, studentPassword, leftLogo, rightLogo } = req.body;
    const nextAdminId = normalizeId(adminUserId || school.adminUserId || `${school.name}-admin`);
    const duplicate = await User.findOne({ userId: nextAdminId, schoolId: { $ne: school._id } });
    if (duplicate) return res.status(409).json({ error: "That admin login ID is already in use." });
    Object.assign(school, {
      name: (name || school.name).trim(),
      address: (address || "").trim(),
      phone: (phone || "").trim(),
      diaryCode: (diaryCode || school.diaryCode).trim(),
      adminPassword: (adminPassword || school.adminPassword).trim(),
      adminUserId: nextAdminId,
      ...(leftLogo !== undefined ? { leftLogo } : {}),
      ...(rightLogo !== undefined ? { rightLogo } : {}),
    });
    if (adminPassword?.trim()) school.adminPasswordHash = passwordHash(adminPassword.trim());
    if (teacherPassword?.trim()) school.teacherPasswordHash = passwordHash(teacherPassword.trim());
    if (studentPassword?.trim()) school.studentPasswordHash = passwordHash(studentPassword.trim());
    await school.save();
    await User.findOneAndUpdate(
      { schoolId: school._id, role: "admin" },
      { userId: nextAdminId, name: `${school.name} Admin`, active: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(devSchoolView(school));
  } catch (err) {
    console.error("PUT /api/dev/schools/:id failed:", err);
    if (err.code === 11000) return res.status(409).json({ error: "That login ID or school value is already in use." });
    res.status(500).json({ error: "Failed to update school." });
  }
});

app.delete("/api/dev/schools/:id", requireDevAuth, async (req, res) => {
  try {
    const school = await School.findByIdAndDelete(req.params.id);
    if (!school) return res.status(404).json({ error: "School not found." });
    await Promise.all([
      User.deleteMany({ schoolId: req.params.id }),
      Teacher.deleteMany({ schoolId: req.params.id }),
      Student.deleteMany({ schoolId: req.params.id }),
      Attendance.deleteMany({ schoolId: req.params.id }),
      Grade.deleteMany({ schoolId: req.params.id }),
      Homework.deleteMany({ schoolId: req.params.id }),
      Material.deleteMany({ schoolId: req.params.id }),
    ]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete school." });
  }
});

// ---------------------------------------------------------------------
// Public compatibility routes used by the original Diary Generator and
// legacy /school/:id pages. These are intentionally left working.
// ---------------------------------------------------------------------
app.get("/api/schools", async (req, res) => {
  try {
    const schools = await School.find().sort({ name: 1 });
    res.json(schools.map(publicSchool));
  } catch {
    res.status(500).json({ error: "Failed to load schools." });
  }
});

app.get("/api/schools/:id", async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json(publicSchool(school));
  } catch {
    res.status(500).json({ error: "Failed to load school." });
  }
});

app.post("/api/schools/:id/verify-code", async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json({ ok: req.body.code === school.diaryCode });
  } catch {
    res.status(500).json({ error: "Failed to verify code." });
  }
});

app.post("/api/schools/:id/verify-admin", async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json({ ok: verifySecret(req.body.password, school.adminPasswordHash, school.adminPassword) });
  } catch {
    res.status(500).json({ error: "Failed to verify password." });
  }
});

app.put("/api/schools/:id/colors", async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id, { colors: req.body.colors }, { new: true, runValidators: true });
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json(publicSchool(school));
  } catch {
    res.status(500).json({ error: "Failed to update colors." });
  }
});

app.get("/api/teachers", async (req, res) => {
  try {
    if (!req.query.schoolId) return res.status(400).json({ error: "schoolId is required." });
    const teachers = await Teacher.find({ schoolId: req.query.schoolId }).sort({ createdAt: 1 });
    res.json(teachers.map(publicTeacher));
  } catch {
    res.status(500).json({ error: "Failed to load teachers." });
  }
});

app.post("/api/teachers", async (req, res) => {
  try {
    const { schoolId, inchargeName, className, section, subjects, userId } = req.body;
    if (!schoolId || !inchargeName?.trim()) return res.status(400).json({ error: "schoolId and inchargeName are required." });
    const cleanUserId = await uniqueUserId(userId, `${inchargeName}-${schoolId.slice(-5)}`);
    const teacher = await Teacher.create({ schoolId, userId: cleanUserId, inchargeName: inchargeName.trim(), className: (className || "").trim(), section: (section || "").trim(), subjects: Array.isArray(subjects) ? subjects : [] });
    await User.create({ schoolId, userId: cleanUserId, role: "teacher", name: teacher.inchargeName, profileId: teacher._id });
    res.status(201).json(publicTeacher(teacher));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "That teacher login ID is already in use." });
    res.status(500).json({ error: "Failed to create teacher." });
  }
});

app.put("/api/teachers/:id", async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ error: "Teacher not found." });
    Object.assign(teacher, { inchargeName: (req.body.inchargeName || teacher.inchargeName).trim(), className: (req.body.className || "").trim(), section: (req.body.section || "").trim(), subjects: Array.isArray(req.body.subjects) ? req.body.subjects : [] });
    await teacher.save();
    await User.findOneAndUpdate({ profileId: teacher._id }, { name: teacher.inchargeName });
    res.json(publicTeacher(teacher));
  } catch {
    res.status(500).json({ error: "Failed to update teacher." });
  }
});

app.delete("/api/teachers/:id", async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!teacher) return res.status(404).json({ error: "Teacher not found." });
    await User.deleteOne({ profileId: teacher._id });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete teacher." });
  }
});

// ---------------------------------------------------------------------
// Admin dashboard: teachers, students, credentials and school settings.
// ---------------------------------------------------------------------
app.get("/api/admin/summary", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const school = await schoolById(req.user.schoolId);
    const [teachers, students, classes] = await Promise.all([
      Teacher.countDocuments({ schoolId: req.user.schoolId, active: true }),
      Student.countDocuments({ schoolId: req.user.schoolId, active: true }),
      Student.distinct("className", { schoolId: req.user.schoolId, active: true, className: { $ne: "" } }),
    ]);
    res.json({ school: publicSchool(school), teachers, students, classes: classes.length });
  } catch {
    res.status(500).json({ error: "Failed to load dashboard summary." });
  }
});

app.get("/api/admin/teachers", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const teachers = await Teacher.find({ schoolId: req.user.schoolId }).sort({ createdAt: 1 });
  res.json(teachers.map(publicTeacher));
}));

app.post("/api/admin/teachers", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, inchargeName, userId, className, section, subjects } = req.body;
    const displayName = (name || inchargeName || "").trim();
    if (!displayName) return res.status(400).json({ error: "Teacher name is required." });
    const cleanUserId = await uniqueUserId(userId, `${displayName}-${req.user.schoolId.slice(-5)}`);
    const teacher = await Teacher.create({ schoolId: req.user.schoolId, userId: cleanUserId, inchargeName: displayName, className: (className || "").trim(), section: (section || "").trim(), subjects: Array.isArray(subjects) ? subjects : [] });
    await User.create({ schoolId: req.user.schoolId, userId: cleanUserId, role: "teacher", name: displayName, profileId: teacher._id });
    res.status(201).json(publicTeacher(teacher));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "That teacher ID is already in use." });
    res.status(500).json({ error: "Failed to add teacher." });
  }
});

app.put("/api/admin/teachers/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
    if (!teacher) return res.status(404).json({ error: "Teacher not found." });
    const nextId = normalizeId(req.body.userId || teacher.userId);
    const currentAccount = await User.findOne({ profileId: teacher._id });
    const duplicateQuery = { userId: nextId };
    if (currentAccount) duplicateQuery._id = { $ne: currentAccount._id };
    const duplicate = await User.findOne(duplicateQuery);
    if (duplicate) return res.status(409).json({ error: "That teacher ID is already in use." });
    Object.assign(teacher, { userId: nextId, inchargeName: (req.body.name || req.body.inchargeName || teacher.inchargeName).trim(), className: (req.body.className || "").trim(), section: (req.body.section || "").trim(), subjects: Array.isArray(req.body.subjects) ? req.body.subjects : [] });
    await teacher.save();
    await User.findOneAndUpdate({ profileId: teacher._id }, { userId: nextId, name: teacher.inchargeName });
    res.json(publicTeacher(teacher));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "That teacher ID is already in use." });
    res.status(500).json({ error: "Failed to update teacher." });
  }
});

app.delete("/api/admin/teachers/:id", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const teacher = await Teacher.findOneAndDelete({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!teacher) return res.status(404).json({ error: "Teacher not found." });
  await User.deleteOne({ profileId: teacher._id });
  res.json({ ok: true });
}));

app.get("/api/admin/students", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const students = await Student.find({ schoolId: req.user.schoolId }).sort({ className: 1, rollNumber: 1, name: 1 });
  res.json(students.map(publicStudent));
}));

app.post("/api/admin/students", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, userId, className, section, rollNumber, parentName, parentPhone } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Student name is required." });
    const cleanUserId = await uniqueUserId(userId, `${name}-${req.user.schoolId.slice(-5)}`);
    const student = await Student.create({ schoolId: req.user.schoolId, userId: cleanUserId, name: name.trim(), className: (className || "").trim(), section: (section || "").trim(), rollNumber: (rollNumber || "").trim(), parentName: (parentName || "").trim(), parentPhone: (parentPhone || "").trim() });
    await User.create({ schoolId: req.user.schoolId, userId: cleanUserId, role: "student", name: student.name, profileId: student._id });
    res.status(201).json(publicStudent(student));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "That student ID is already in use." });
    res.status(500).json({ error: "Failed to add student." });
  }
});

app.put("/api/admin/students/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
    if (!student) return res.status(404).json({ error: "Student not found." });
    const nextId = normalizeId(req.body.userId || student.userId);
    const duplicate = await User.findOne({ userId: nextId, profileId: { $ne: student._id } });
    if (duplicate) return res.status(409).json({ error: "That student ID is already in use." });
    Object.assign(student, { userId: nextId, name: (req.body.name || student.name).trim(), className: (req.body.className || "").trim(), section: (req.body.section || "").trim(), rollNumber: (req.body.rollNumber || "").trim(), parentName: (req.body.parentName || "").trim(), parentPhone: (req.body.parentPhone || "").trim() });
    await student.save();
    await User.findOneAndUpdate({ profileId: student._id }, { userId: nextId, name: student.name });
    res.json(publicStudent(student));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "That student ID is already in use." });
    res.status(500).json({ error: "Failed to update student." });
  }
});

app.delete("/api/admin/students/:id", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const student = await Student.findOneAndDelete({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!student) return res.status(404).json({ error: "Student not found." });
  await Promise.all([User.deleteOne({ profileId: student._id }), Grade.deleteMany({ studentId: student._id }), Attendance.updateMany({}, { $pull: { records: { studentId: student._id } } })]);
  res.json({ ok: true });
}));

app.put("/api/admin/settings", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const school = await School.findById(req.user.schoolId);
    if (!school) return res.status(404).json({ error: "School not found." });
    const { name, address, phone, colors, teacherPassword, studentPassword } = req.body;
    if (name?.trim()) school.name = name.trim();
    if (address !== undefined) school.address = String(address).trim();
    if (phone !== undefined) school.phone = String(phone).trim();
    if (colors && typeof colors === "object") school.colors = colors;
    if (teacherPassword?.trim()) school.teacherPasswordHash = passwordHash(teacherPassword.trim());
    if (studentPassword?.trim()) school.studentPasswordHash = passwordHash(studentPassword.trim());
    await school.save();
    const admin = await User.findOne({ schoolId: school._id, role: "admin" });
    if (admin) {
      admin.name = `${school.name} Admin`;
      await admin.save();
    }
    res.json({ school: publicSchool(school), teacherPasswordConfigured: Boolean(school.teacherPasswordHash), studentPasswordConfigured: Boolean(school.studentPasswordHash) });
  } catch {
    res.status(500).json({ error: "Failed to save school settings." });
  }
});

// ---------------------------------------------------------------------
// Teacher dashboard services
// ---------------------------------------------------------------------
app.get("/api/teacher/overview", requireAuth, requireRole("teacher"), async (req, res) => {
  try {
    const teacher = await teacherForSession(req);
    if (!teacher) return res.status(404).json({ error: "Teacher profile not found." });
    const scope = classScope(teacher);
    const [students, homework, materials, grades] = await Promise.all([
      Student.find({ schoolId: req.user.schoolId, className: scope.className, section: scope.section, active: true }).sort({ rollNumber: 1, name: 1 }),
      Homework.find({ schoolId: req.user.schoolId, teacherId: teacher._id }).sort({ createdAt: -1 }).limit(8),
      Material.find({ schoolId: req.user.schoolId, teacherId: teacher._id }).sort({ createdAt: -1 }).limit(8),
      Grade.find({ schoolId: req.user.schoolId, teacherId: teacher._id }).sort({ createdAt: -1 }).limit(30),
    ]);
    res.json({ teacher: publicTeacher(teacher), students: students.map(publicStudent), homework: homework.map(publicHomework), materials: materials.map(publicMaterial), grades: grades.map(publicGrade) });
  } catch {
    res.status(500).json({ error: "Failed to load teacher dashboard." });
  }
});

app.get("/api/teacher/attendance", requireAuth, requireRole("teacher"), asyncHandler(async (req, res) => {
  const teacher = await teacherForSession(req);
  if (!teacher) return res.status(404).json({ error: "Teacher profile not found." });
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const [students, record] = await Promise.all([
    Student.find({ schoolId: req.user.schoolId, className: teacher.className, section: teacher.section, active: true }).sort({ rollNumber: 1, name: 1 }),
    Attendance.findOne({ schoolId: req.user.schoolId, teacherId: teacher._id, date }),
  ]);
  res.json({ students: students.map(publicStudent), record: publicAttendance(record) });
}));

app.post("/api/teacher/attendance", requireAuth, requireRole("teacher"), async (req, res) => {
  try {
    const teacher = await teacherForSession(req);
    if (!teacher) return res.status(404).json({ error: "Teacher profile not found." });
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const students = await Student.find({ schoolId: req.user.schoolId, className: teacher.className, section: teacher.section, active: true }).select("_id");
    const allowed = new Set(students.map((s) => idOf(s._id)));
    const records = (Array.isArray(req.body.records) ? req.body.records : []).filter((r) => allowed.has(String(r.studentId))).map((r) => ({ studentId: r.studentId, status: ["present", "absent", "late"].includes(r.status) ? r.status : "present", note: String(r.note || "").slice(0, 300) }));
    const saved = await Attendance.findOneAndUpdate({ schoolId: req.user.schoolId, teacherId: teacher._id, date }, { schoolId: req.user.schoolId, teacherId: teacher._id, className: teacher.className, section: teacher.section, date, records }, { new: true, upsert: true, setDefaultsOnInsert: true });
    res.json(publicAttendance(saved));
  } catch {
    res.status(500).json({ error: "Failed to save attendance." });
  }
});

app.post("/api/teacher/grades", requireAuth, requireRole("teacher"), async (req, res) => {
  try {
    const teacher = await teacherForSession(req);
    if (!teacher) return res.status(404).json({ error: "Teacher profile not found." });
    const student = await Student.findOne({ _id: req.body.studentId, schoolId: req.user.schoolId, className: teacher.className, section: teacher.section });
    if (!student) return res.status(400).json({ error: "Choose a student from your class." });
    const marks = Number(req.body.marks);
    const maxMarks = Number(req.body.maxMarks);
    if (!req.body.subject?.trim() || !req.body.assessment?.trim() || !Number.isFinite(marks) || !Number.isFinite(maxMarks) || maxMarks <= 0 || marks < 0 || marks > maxMarks) return res.status(400).json({ error: "Enter valid subject, assessment and marks." });
    const grade = await Grade.create({ schoolId: req.user.schoolId, teacherId: teacher._id, studentId: student._id, subject: req.body.subject.trim(), assessment: req.body.assessment.trim(), marks, maxMarks, term: (req.body.term || "Current term").trim(), feedback: (req.body.feedback || "").trim(), date: req.body.date || new Date().toISOString().slice(0, 10) });
    res.status(201).json(publicGrade(grade));
  } catch {
    res.status(500).json({ error: "Failed to save grade." });
  }
});

app.post("/api/teacher/homework", requireAuth, requireRole("teacher"), async (req, res) => {
  try {
    const teacher = await teacherForSession(req);
    if (!teacher) return res.status(404).json({ error: "Teacher profile not found." });
    if (!req.body.subject?.trim() || !req.body.title?.trim()) return res.status(400).json({ error: "Subject and title are required." });
    const item = await Homework.create({ schoolId: req.user.schoolId, teacherId: teacher._id, className: teacher.className, section: teacher.section, subject: req.body.subject.trim(), title: req.body.title.trim(), description: (req.body.description || "").trim(), dueDate: req.body.dueDate || "", attachmentUrl: req.body.attachmentUrl || "", attachmentData: req.body.attachmentData || "", attachmentName: req.body.attachmentName || "" });
    res.status(201).json(publicHomework(item));
  } catch {
    res.status(500).json({ error: "Failed to publish homework." });
  }
});

app.post("/api/teacher/materials", requireAuth, requireRole("teacher"), async (req, res) => {
  try {
    const teacher = await teacherForSession(req);
    if (!teacher) return res.status(404).json({ error: "Teacher profile not found." });
    if (!req.body.subject?.trim() || !req.body.title?.trim()) return res.status(400).json({ error: "Subject and title are required." });
    const item = await Material.create({ schoolId: req.user.schoolId, teacherId: teacher._id, className: teacher.className, section: teacher.section, subject: req.body.subject.trim(), title: req.body.title.trim(), description: (req.body.description || "").trim(), url: req.body.url || "", fileData: req.body.fileData || "", fileName: req.body.fileName || "", kind: req.body.kind === "test" ? "test" : "material" });
    res.status(201).json(publicMaterial(item));
  } catch {
    res.status(500).json({ error: "Failed to publish study material." });
  }
});

// ---------------------------------------------------------------------
// Student dashboard services
// ---------------------------------------------------------------------
app.get("/api/student/overview", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const student = await studentForSession(req);
    if (!student) return res.status(404).json({ error: "Student profile not found." });
    const scope = { schoolId: req.user.schoolId, className: student.className, section: student.section };
    const [homework, materials, grades, attendance] = await Promise.all([
      Homework.find(scope).sort({ createdAt: -1 }).limit(30),
      Material.find(scope).sort({ createdAt: -1 }).limit(30),
      Grade.find({ schoolId: req.user.schoolId, studentId: student._id }).sort({ createdAt: -1 }).limit(50),
      Attendance.find({ schoolId: req.user.schoolId, className: student.className, section: student.section, "records.studentId": student._id }).sort({ date: -1 }).limit(10),
    ]);
    res.json({ student: publicStudent(student), homework: homework.map(publicHomework), materials: materials.map(publicMaterial), tests: materials.filter((m) => m.kind === "test").map(publicMaterial), grades: grades.map(publicGrade), attendance: attendance.map(publicAttendance) });
  } catch {
    res.status(500).json({ error: "Failed to load student dashboard." });
  }
});

app.listen(PORT, () => console.log(`API server listening on port ${PORT}`));

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (err.type === "entity.too.large") return res.status(413).json({ error: "That upload is too large." });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed request." });
  res.status(500).json({ error: "Server error." });
});
