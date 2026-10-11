import "dotenv/config";
import crypto from "node:crypto";
import { promisify } from "node:util";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Teacher from "./Teacher.js";
import School from "./School.js";
import Student from "./Student.js";
import Attendance from "./Attendance.js";
import Grade from "./Grade.js";
import Homework from "./Homework.js";
import Material from "./Material.js";
import Classroom from "./Classroom.js";
import TimetableItem from "./TimetableItem.js";
import CalendarEvent from "./CalendarEvent.js";
import Exam from "./Exam.js";
import FeeInvoice from "./FeeInvoice.js";
import AssignmentSubmission from "./AssignmentSubmission.js";
import AuditLog from "./AuditLog.js";

const app = express();
const scrypt = promisify(crypto.scrypt);
app.use(cors());
// Raised from the default ~100kb so uploaded logos (sent as base64 data
// URIs from the Dev Portal) fit comfortably in the request body.
app.use(express.json({ limit: "10mb" }));

const { MONGODB_URI, PORT = 4000, DEV_PASSWORD } = process.env;
const SESSION_SECRET = process.env.SESSION_SECRET || DEV_PASSWORD;

if (!MONGODB_URI) {
  console.error(
    "Missing MONGODB_URI environment variable. Set it to your MongoDB connection string before starting the server."
  );
  process.exit(1);
}

if (!DEV_PASSWORD) {
  console.error(
    "Missing DEV_PASSWORD environment variable. Set it to a password of your choice — this protects the /dev portal that manages every school's codes and passwords."
  );
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB");
    // Bring the collections' actual indexes in line with what the schemas
    // declare today — this drops any stale index left over from an earlier
    // version of a schema (e.g. an old unique "slug" index that no longer
    // has a matching field) and creates any that are missing. Without this,
    // a leftover unique index on a field the app no longer sets can make
    // every new document after the first one collide on that field's
    // shared "missing value", and every write fails with a 409 that has
    // nothing to do with your actual data.
    try {
      await School.syncIndexes();
      await Teacher.syncIndexes();
      await Student.syncIndexes();
      await Attendance.syncIndexes();
      await Grade.syncIndexes();
      await Homework.syncIndexes();
      await Material.syncIndexes();
      await Classroom.syncIndexes();
      await TimetableItem.syncIndexes();
      await CalendarEvent.syncIndexes();
      await Exam.syncIndexes();
      await FeeInvoice.syncIndexes();
      await AssignmentSubmission.syncIndexes();
      await AuditLog.syncIndexes();
      console.log("Indexes synced");
    } catch (err) {
      console.error("Failed to sync indexes:", err);
    }
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// Dev-portal auth — every /api/dev/* route requires this header, checked
// against the DEV_PASSWORD environment variable. This is what lets one
// person manage every school's codes/passwords from a single /dev screen.
// ---------------------------------------------------------------------
function requireDevAuth(req, res, next) {
  const provided = req.header("x-dev-password");
  if (provided !== DEV_PASSWORD) {
    return res.status(401).json({ error: "Invalid dev password." });
  }
  next();
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [algorithm, salt, expectedHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(password, salt, expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function loginIdIsInUse(userId, { schoolId, role, profileId, allowCurrentGeneral = false } = {}) {
  const [schools, teachers, students] = await Promise.all([
    School.find({ $or: [{ adminUserId: userId }, { teacherLoginId: userId }, { studentLoginId: userId }] })
      .select("_id adminUserId teacherLoginId studentLoginId")
      .lean(),
    Teacher.find({ userId }).select("_id").lean(),
    Student.find({ userId }).select("_id").lean(),
  ]);

  const schoolConflict = schools.some((school) => {
    const isCurrentSchool = schoolId && String(school._id) === String(schoolId);
    return school.adminUserId === userId ||
      (school.teacherLoginId === userId && !(allowCurrentGeneral && isCurrentSchool && role === "teacher")) ||
      (school.studentLoginId === userId && !(allowCurrentGeneral && isCurrentSchool && role === "student"));
  });
  const teacherConflict = teachers.some((teacher) => !(role === "teacher" && profileId && String(teacher._id) === String(profileId)));
  const studentConflict = students.some((student) => !(role === "student" && profileId && String(student._id) === String(profileId)));
  return schoolConflict || teacherConflict || studentConflict;
}

async function devLoginIdIsInUse(userId, exceptSchoolId) {
  const [schools, teacherConflict, studentConflict] = await Promise.all([
    School.find({ $or: [{ adminUserId: userId }, { teacherLoginId: userId }, { studentLoginId: userId }] })
      .select("_id adminUserId teacherLoginId studentLoginId")
      .lean(),
    Teacher.exists({ userId }),
    Student.exists({ userId }),
  ]);
  const schoolConflict = schools.some((school) =>
    school.teacherLoginId === userId || school.studentLoginId === userId ||
    (school.adminUserId === userId && (!exceptSchoolId || String(school._id) !== String(exceptSchoolId)))
  );
  return Boolean(schoolConflict || teacherConflict || studentConflict);
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function requireAuth(req, res, next) {
  const [body, signature, extra] = (req.header("authorization") || "").replace(/^Bearer\s+/i, "").split(".");
  if (!body || !signature || extra || !SESSION_SECRET) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return res.status(401).json({ error: "Your session is invalid. Please sign in again." });
  }
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!session.exp || session.exp <= Date.now()) {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
    req.session = session;
    next();
  } catch {
    return res.status(401).json({ error: "Your session is invalid. Please sign in again." });
  }
}

function requireAdmin(req, res, next) {
  if (req.session?.role !== "admin") {
    return res.status(403).json({ error: "Administrator access is required." });
  }
  next();
}

function requireTeacher(req, res, next) {
  if (req.session?.role !== "teacher") {
    return res.status(403).json({ error: "Teacher access is required." });
  }
  if (!req.session.teacherId) {
    return res.status(403).json({ error: "Use your specific teacher ID for class and attendance tools. The general teacher ID cannot identify an individual class." });
  }
  next();
}

function requireStudent(req, res, next) {
  if (req.session?.role !== "student") {
    return res.status(403).json({ error: "Student access is required." });
  }
  if (!req.session.studentId) {
    return res.status(403).json({ error: "Use your specific student ID to view personal school records." });
  }
  next();
}

function requireLegacySchoolAdmin(req, res, next) {
  if (req.session?.role !== "legacyAdmin" || String(req.session.schoolId) !== String(req.params.schoolId || req.body.schoolId || "")) {
    return res.status(403).json({ error: "School administrator access is required." });
  }
  next();
}

function requireSchoolAdminScope(req, res, next) {
  const schoolId = String(req.params.schoolId || req.body.schoolId || "");
  const roleAllowed = req.session?.role === "admin" || req.session?.role === "legacyAdmin";
  if (!roleAllowed || !schoolId || String(req.session.schoolId) !== schoolId) {
    return res.status(403).json({ error: "School administrator access is required." });
  }
  next();
}

async function requireTeacherSchoolAdmin(req, res, next) {
  try {
    const teacher = await Teacher.findById(req.params.id).select("schoolId");
    if (!teacher) return res.status(404).json({ error: "Teacher not found." });
    const roleAllowed = req.session?.role === "admin" || req.session?.role === "legacyAdmin";
    if (!roleAllowed || String(req.session.schoolId) !== String(teacher.schoolId)) {
      return res.status(403).json({ error: "School administrator access is required." });
    }
    next();
  } catch {
    res.status(400).json({ error: "Invalid teacher ID." });
  }
}

async function getTeacherProfile(req) {
  return Teacher.findOne({ _id: req.session.teacherId, schoolId: req.session.schoolId, active: { $ne: false } });
}

function publicRecord(document) {
  return { ...document.toObject(), id: String(document._id) };
}

async function writeAudit(req, action, entity = "", entityId = "", details = {}) {
  try {
    await AuditLog.create({
      schoolId: req.session?.schoolId || null,
      actorId: req.session?.userId || req.session?.teacherId || req.session?.studentId || "",
      actorName: req.session?.name || "",
      role: req.session?.role || "system",
      action,
      entity,
      entityId: String(entityId || ""),
      ip: req.ip || "",
      details,
    });
  } catch (err) {
    console.error("Audit log write failed:", err.message);
  }
}

async function deleteTeacherRecords(teacherId, schoolId) {
  const filter = { teacherId, ...(schoolId ? { schoolId } : {}) };
  await Promise.all([
    Attendance.deleteMany(filter),
    Grade.deleteMany(filter),
    Homework.deleteMany(filter),
    Material.deleteMany(filter),
    TimetableItem.deleteMany(filter),
    Classroom.updateMany({ schoolId, teacherIds: teacherId }, { $pull: { teacherIds: teacherId } }),
    Exam.updateMany({ schoolId, createdByTeacherId: teacherId }, { $set: { createdByTeacherId: null } }),
  ]);
}

async function deleteStudentRecords(studentId, schoolId) {
  await Promise.all([
    Grade.deleteMany({ studentId, schoolId }),
    FeeInvoice.deleteMany({ studentId, schoolId }),
    AssignmentSubmission.deleteMany({ studentId, schoolId }),
    Attendance.updateMany(
      { schoolId, "records.studentId": studentId },
      { $pull: { records: { studentId } } }
    ),
  ]);
}

async function deleteSchoolRecords(schoolId) {
  await Promise.all([
    Teacher.deleteMany({ schoolId }),
    Student.deleteMany({ schoolId }),
    Attendance.deleteMany({ schoolId }),
    Grade.deleteMany({ schoolId }),
    Homework.deleteMany({ schoolId }),
    Material.deleteMany({ schoolId }),
    Classroom.deleteMany({ schoolId }),
    TimetableItem.deleteMany({ schoolId }),
    CalendarEvent.deleteMany({ schoolId }),
    Exam.deleteMany({ schoolId }),
    FeeInvoice.deleteMany({ schoolId }),
    AssignmentSubmission.deleteMany({ schoolId }),
  ]);
}

function feeSummary(invoice) {
  const record = invoice.toObject ? invoice.toObject() : invoice;
  const paid = (record.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const balance = Math.max(0, Number(record.amount || 0) - Number(record.discount || 0) - paid);
  return { ...record, id: String(record._id), paid, balance, status: balance <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid" };
}

async function createExam(input, schoolId, createdByTeacherId = null) {
  const { title, type, className, section, subject, date, startTime, endTime, room, maxMarks, instructions } = input;
  if (!String(title || "").trim() || !String(className || "").trim() || !String(subject || "").trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("Exam title, class, subject and valid date are required.");
  if ((startTime || endTime) && (!/^\d{2}:\d{2}$/.test(startTime || "") || !/^\d{2}:\d{2}$/.test(endTime || "") || startTime >= endTime)) throw new Error("Enter a valid exam time range.");
  const maximum = Number(maxMarks || 100);
  if (!Number.isFinite(maximum) || maximum < 1) throw new Error("Maximum marks must be at least one.");
  return Exam.create({ schoolId, title: String(title).trim(), type: type || "unit", className: String(className).trim(), section: String(section || "").trim(), subject: String(subject).trim(), date, startTime: startTime || "", endTime: endTime || "", room: String(room || "").trim(), maxMarks: maximum, instructions: String(instructions || "").trim(), ...(createdByTeacherId ? { createdByTeacherId } : {}) });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += character;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = (rows.shift() || []).map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const userId = String(req.body.userId || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!userId || !password) return res.status(400).json({ error: "Enter your login ID and password." });

    const [schools, teachers, students] = await Promise.all([
      School.find({ $or: [{ adminUserId: userId }, { teacherLoginId: userId }, { studentLoginId: userId }] }),
      Teacher.find({ userId, active: { $ne: false } }),
      Student.find({ userId, active: { $ne: false } }),
    ]);
    const candidates = [];
    for (const school of schools) {
      if (school.adminUserId === userId) candidates.push({ role: "admin", school });
      if (school.teacherLoginId === userId) candidates.push({ role: "teacher", school, general: true });
      if (school.studentLoginId === userId) candidates.push({ role: "student", school, general: true });
    }
    for (const teacher of teachers) candidates.push({ role: "teacher", profile: teacher, schoolId: teacher.schoolId });
    for (const student of students) candidates.push({ role: "student", profile: student, schoolId: student.schoolId });

    if (candidates.length > 1) {
      return res.status(409).json({ error: "This login ID matches more than one account. Ask your administrator to make the IDs unique." });
    }
    const account = candidates[0];
    if (!account) return res.status(401).json({ error: "Invalid login ID or password." });

    const school = account.school || await School.findById(account.schoolId);
    if (!school) return res.status(401).json({ error: "This school's account is unavailable." });
    const passwordHash = account.role === "admin"
      ? school.adminPasswordHash
      : account.role === "teacher" ? school.teacherPasswordHash : school.studentPasswordHash;
    let valid = await verifyPassword(password, passwordHash);
    // Existing schools may still have a plain-text admin password. Migrate it
    // to a salted hash at the first successful central login.
    if (account.role === "admin" && !valid && !school.adminPasswordHash && school.adminPassword) {
      valid = password === school.adminPassword;
      if (valid) {
        school.adminPasswordHash = await hashPassword(password);
        school.adminPassword = "";
        await school.save();
      }
    }
    if (!valid) return res.status(401).json({ error: "Invalid login ID or password." });

    if (account.general && !req.body.profileId) {
      const profiles = account.role === "teacher"
        ? await Teacher.find({ schoolId: school._id, active: { $ne: false } }).sort({ inchargeName: 1 })
        : await Student.find({ schoolId: school._id, active: { $ne: false } }).sort({ name: 1 });
      return res.json({
        requiresProfileSelection: true,
        role: account.role,
        schoolName: school.name,
        profiles: profiles.map((profile) => ({
          id: String(profile._id),
          name: account.role === "teacher" ? profile.inchargeName : profile.name,
          className: profile.className,
          section: profile.section,
          ...(account.role === "student" ? { rollNumber: profile.rollNumber } : {}),
        })),
      });
    }

    if (account.general) {
      const profileModel = account.role === "teacher" ? Teacher : Student;
      const profile = await profileModel.findOne({ _id: req.body.profileId, schoolId: school._id, active: { $ne: false } });
      if (!profile) return res.status(400).json({ error: "Choose a valid profile for this general login ID." });
      account.profile = profile;
    }

    const user = {
      userId,
      name: account.role === "admin" ? school.name : account.role === "teacher"
        ? account.profile.inchargeName : account.profile.name,
      role: account.role,
      schoolId: String(school._id),
      ...(account.general ? { generalLogin: true } : {}),
      ...(account.role === "teacher" && account.profile ? { teacherId: String(account.profile._id) } : {}),
      ...(account.role === "student" && account.profile ? { studentId: String(account.profile._id) } : {}),
    };
    res.json({
      token: signSession(user),
      user,
      school: {
        id: String(school._id),
        name: school.name,
        address: school.address,
        phone: school.phone,
        colors: school.colors,
      },
    });
  } catch (err) {
    console.error("POST /api/auth/login failed:", err);
    res.status(500).json({ error: "Unable to sign in right now." });
  }
});

app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const school = await School.findById(req.session.schoolId);
    if (!school) return res.status(401).json({ error: "This school account no longer exists." });
    let name = school.name;
    if (req.session.role === "teacher" && req.session.teacherId) {
      const teacher = await Teacher.findOne({ _id: req.session.teacherId, schoolId: school._id, active: { $ne: false } });
      if (!teacher) return res.status(401).json({ error: "This teacher account no longer exists." });
      name = teacher.inchargeName;
    } else if (req.session.role === "student" && req.session.studentId) {
      const student = await Student.findOne({ _id: req.session.studentId, schoolId: school._id, active: { $ne: false } });
      if (!student) return res.status(401).json({ error: "This student account no longer exists." });
      name = student.name;
    } else if (req.session.role !== "admin") {
      name = req.session.role === "teacher" ? "General teacher account" : "General student account";
    }
    res.json({
      user: { userId: req.session.userId, name, role: req.session.role, schoolId: String(school._id), ...(req.session.generalAccount ? { generalAccount: true } : {}), ...(req.session.teacherId ? { teacherId: req.session.teacherId } : {}), ...(req.session.studentId ? { studentId: req.session.studentId } : {}) },
      school: { id: String(school._id), name: school.name, address: school.address, phone: school.phone, email: school.email, logo: school.logo, currency: school.currency, timezone: school.timezone, academicYear: school.academicYear, gradingSystem: school.gradingSystem, settings: school.settings, colors: school.colors, teacherLoginId: school.teacherLoginId, studentLoginId: school.studentLoginId },
    });
  } catch (err) {
    res.status(500).json({ error: "Unable to load your account." });
  }
});

// A quick way for the frontend to check a dev password before showing the
// portal, without yet needing to know a school id.
app.post("/api/dev/verify", (req, res) => {
  res.json({ ok: req.body.password === DEV_PASSWORD });
});

// ---------------------------------------------------------------------
// Public school routes — used by the school-picker and diary/admin pages.
// These deliberately never return diaryCode or adminPassword.
// ---------------------------------------------------------------------
function publicSchool(s) {
  return {
    id: s._id,
    name: s.name,
    address: s.address,
    phone: s.phone,
    colors: s.colors,
    leftLogo: s.leftLogo,
    rightLogo: s.rightLogo,
  };
}

function devSchool(s) {
  const school = s.toObject ? s.toObject() : { ...s };
  school.hasAdminPassword = Boolean(school.adminPasswordHash || school.adminPassword);
  delete school.adminPassword;
  delete school.adminPasswordHash;
  delete school.teacherPasswordHash;
  delete school.studentPasswordHash;
  return { ...school, id: String(school._id || school.id) };
}

app.get("/api/schools", async (req, res) => {
  try {
    const schools = await School.find().sort({ name: 1 });
    res.json(schools.map(publicSchool));
  } catch (err) {
    res.status(500).json({ error: "Failed to load schools." });
  }
});

app.get("/api/schools/:id", async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json(publicSchool(school));
  } catch (err) {
    res.status(500).json({ error: "Failed to load school." });
  }
});

app.post("/api/schools/:id/verify-code", async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json({ ok: req.body.code === school.diaryCode });
  } catch (err) {
    res.status(500).json({ error: "Failed to verify code." });
  }
});

app.post("/api/schools/:id/verify-admin", async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ error: "School not found." });
    const ok = school.adminPasswordHash
      ? await verifyPassword(String(req.body.password || ""), school.adminPasswordHash)
      : req.body.password === school.adminPassword;
    res.json({
      ok,
      ...(ok ? { token: signSession({ role: "legacyAdmin", schoolId: String(school._id) }) } : {}),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to verify password." });
  }
});

// Lets a school's own Admin Portal change its diary's theme colors. This is
// intentionally separate from the /api/dev/schools routes (which manage
// codes/passwords and need the DEV_PASSWORD) — colors are a per-school admin
// concern, not a super-admin one.
app.put("/api/schools/:schoolId/colors", requireAuth, requireLegacySchoolAdmin, async (req, res) => {
  try {
    const { colors } = req.body;
    if (!colors || typeof colors !== "object") {
      return res.status(400).json({ error: "colors is required." });
    }
    const school = await School.findByIdAndUpdate(
      req.params.schoolId,
      { colors },
      { new: true, runValidators: true }
    );
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json(publicSchool(school));
  } catch (err) {
    res.status(500).json({ error: "Failed to update colors." });
  }
});

// ---------------------------------------------------------------------
// Dev routes — full CRUD on schools, including their codes/passwords.
// ---------------------------------------------------------------------
app.get("/api/dev/schools", requireDevAuth, async (req, res) => {
  try {
    const schools = await School.find().sort({ name: 1 });
    res.json(schools.map(devSchool));
  } catch (err) {
    res.status(500).json({ error: "Failed to load schools." });
  }
});

app.post("/api/dev/schools", requireDevAuth, async (req, res) => {
  try {
    const { name, address, phone, diaryCode, adminUserId, adminPassword, leftLogo, rightLogo } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "name is required." });
    if (!diaryCode || !diaryCode.trim())
      return res.status(400).json({ error: "diaryCode is required." });
    if (!adminUserId || !adminUserId.trim())
      return res.status(400).json({ error: "Admin login ID is required." });
    if (!adminPassword || !adminPassword.trim())
      return res.status(400).json({ error: "adminPassword is required." });

    const normalizedAdminId = adminUserId.trim().toLowerCase();
    if (await devLoginIdIsInUse(normalizedAdminId)) {
      return res.status(409).json({ error: "That admin login ID is already in use." });
    }

    const school = await School.create({
      name: name.trim(),
      address: (address || "").trim(),
      phone: (phone || "").trim(),
      diaryCode: diaryCode.trim(),
      adminPassword: "",
      adminUserId: normalizedAdminId,
      adminPasswordHash: await hashPassword(adminPassword),
      // Logos are optional — a school can be added without them and have
      // them uploaded later by editing it from the Dev Portal.
      leftLogo: leftLogo || "",
      rightLogo: rightLogo || "",
    });
    res.status(201).json(devSchool(school));
  } catch (err) {
    // Log the full error server-side (visible in your Render logs) and, on
    // this password-protected dev route, also send it back in the response
    // so it shows up directly in the browser's Network tab — no need to go
    // dig through server logs to see what actually went wrong.
    console.error("POST /api/dev/schools failed:", err);
    if (err.code === 11000) {
      // A unique index rejected the write — almost always a diary code or
      // school name that's already used by another school.
      const field = Object.keys(err.keyPattern || {})[0] || "field";
      return res
        .status(409)
        .json({ error: `That ${field} is already used by another school.` });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: `Failed to create school: ${err.message}` });
  }
});

app.put("/api/dev/schools/:id", requireDevAuth, async (req, res) => {
  try {
    const { name, address, phone, diaryCode, adminUserId, adminPassword, leftLogo, rightLogo } = req.body;
    const normalizedAdminId = String(adminUserId || "").trim().toLowerCase();
    if (!normalizedAdminId) return res.status(400).json({ error: "Admin login ID is required." });
    if (await devLoginIdIsInUse(normalizedAdminId, req.params.id)) {
      return res.status(409).json({ error: "That admin login ID is already in use." });
    }
    const existingSchool = await School.findById(req.params.id);
    if (!existingSchool) return res.status(404).json({ error: "School not found." });
    const nextPasswordHash = adminPassword?.trim()
      ? await hashPassword(adminPassword.trim())
      : existingSchool.adminPasswordHash || (existingSchool.adminPassword ? await hashPassword(existingSchool.adminPassword) : "");
    if (!nextPasswordHash) return res.status(400).json({ error: "Set an admin login password before saving this school." });
    const school = await School.findByIdAndUpdate(
      req.params.id,
      {
        name: (name || "").trim(),
        address: (address || "").trim(),
        phone: (phone || "").trim(),
        diaryCode: (diaryCode || "").trim(),
        adminPassword: "",
        adminUserId: normalizedAdminId,
        adminPasswordHash: nextPasswordHash,
        // leftLogo/rightLogo are only overwritten when a value is actually
        // sent, so leaving the upload fields untouched while editing other
        // details (like the address) doesn't wipe out an existing logo.
        ...(leftLogo !== undefined ? { leftLogo } : {}),
        ...(rightLogo !== undefined ? { rightLogo } : {}),
      },
      { new: true, runValidators: true }
    );
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json(devSchool(school));
  } catch (err) {
    console.error("PUT /api/dev/schools/:id failed:", err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "field";
      return res
        .status(409)
        .json({ error: `That ${field} is already used by another school.` });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: `Failed to update school: ${err.message}` });
  }
});

app.delete("/api/dev/schools/:id", requireDevAuth, async (req, res) => {
  try {
    const school = await School.findByIdAndDelete(req.params.id);
    if (!school) return res.status(404).json({ error: "School not found." });
    await deleteSchoolRecords(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete school." });
  }
});

// ---------------------------------------------------------------------
// Admin dashboard API — all operations are restricted to the signed-in
// administrator's own school.
// ---------------------------------------------------------------------
app.get("/api/admin/summary", requireAuth, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.session.schoolId;
    const [school, teachers, students, classes] = await Promise.all([
      School.findById(schoolId),
      Teacher.countDocuments({ schoolId }),
      Student.countDocuments({ schoolId }),
      Student.distinct("className", { schoolId, className: { $ne: "" } }),
    ]);
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json({
      school: { id: String(school._id), name: school.name, address: school.address, phone: school.phone, email: school.email, logo: school.logo, currency: school.currency, timezone: school.timezone, academicYear: school.academicYear, gradingSystem: school.gradingSystem, settings: school.settings, colors: school.colors, teacherLoginId: school.teacherLoginId, studentLoginId: school.studentLoginId },
      teachers,
      students,
      classes: classes.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Unable to load the school summary." });
  }
});

app.get("/api/admin/teachers", requireAuth, requireAdmin, async (req, res) => {
  try {
    const teachers = await Teacher.find({ schoolId: req.session.schoolId }).sort({ createdAt: 1 });
    res.json(teachers.map((teacher) => ({
      id: String(teacher._id),
      userId: teacher.userId || "",
      name: teacher.inchargeName,
      className: teacher.className,
      section: teacher.section,
      subjects: teacher.subjects,
    })));
  } catch (err) {
    res.status(500).json({ error: "Unable to load teachers." });
  }
});

app.post("/api/admin/teachers", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, name, className, section, subjects } = req.body;
    if (!userId?.trim() || !name?.trim()) return res.status(400).json({ error: "Teacher ID and name are required." });
    const normalizedUserId = userId.trim().toLowerCase();
    if (await loginIdIsInUse(normalizedUserId, { schoolId: req.session.schoolId, role: "teacher" })) {
      return res.status(409).json({ error: "That login ID is already in use. Choose a different specific teacher ID." });
    }
    const teacher = await Teacher.create({
      schoolId: req.session.schoolId,
      userId: normalizedUserId,
      inchargeName: name.trim(),
      className: (className || "").trim(),
      section: (section || "").trim(),
      subjects: Array.isArray(subjects) ? subjects : [],
    });
    res.status(201).json({ id: String(teacher._id) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "That teacher ID is already in use in this school." });
    res.status(500).json({ error: "Unable to create teacher." });
  }
});

app.put("/api/admin/teachers/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, name, className, section, subjects } = req.body;
    if (!userId?.trim() || !name?.trim()) return res.status(400).json({ error: "Teacher ID and name are required." });
    const normalizedUserId = userId.trim().toLowerCase();
    if (await loginIdIsInUse(normalizedUserId, { schoolId: req.session.schoolId, role: "teacher", profileId: req.params.id })) {
      return res.status(409).json({ error: "That login ID is already in use. Choose a different specific teacher ID." });
    }
    const teacher = await Teacher.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.session.schoolId },
      { userId: normalizedUserId, inchargeName: name.trim(), className: (className || "").trim(), section: (section || "").trim(), subjects: Array.isArray(subjects) ? subjects : [] },
      { new: true, runValidators: true }
    );
    if (!teacher) return res.status(404).json({ error: "Teacher not found." });
    res.json({ id: String(teacher._id) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "That teacher ID is already in use in this school." });
    res.status(500).json({ error: "Unable to update teacher." });
  }
});

app.delete("/api/admin/teachers/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const teacher = await Teacher.findOneAndDelete({ _id: req.params.id, schoolId: req.session.schoolId });
    if (!teacher) return res.status(404).json({ error: "Teacher not found." });
    await deleteTeacherRecords(teacher._id, req.session.schoolId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Unable to remove teacher." });
  }
});

app.get("/api/admin/students", requireAuth, requireAdmin, async (req, res) => {
  try {
    const students = await Student.find({ schoolId: req.session.schoolId }).sort({ createdAt: 1 });
    res.json(students.map((student) => ({ ...student.toObject(), id: String(student._id) })));
  } catch (err) {
    res.status(500).json({ error: "Unable to load students." });
  }
});

app.post("/api/admin/students", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, name, className, section, rollNumber, parentName, parentPhone } = req.body;
    if (!userId?.trim() || !name?.trim()) return res.status(400).json({ error: "Student ID and name are required." });
    const normalizedUserId = userId.trim().toLowerCase();
    if (await loginIdIsInUse(normalizedUserId, { schoolId: req.session.schoolId, role: "student" })) {
      return res.status(409).json({ error: "That login ID is already in use. Choose a different specific student ID." });
    }
    const student = await Student.create({
      schoolId: req.session.schoolId,
      userId: normalizedUserId,
      name: name.trim(),
      className: (className || "").trim(),
      section: (section || "").trim(),
      rollNumber: (rollNumber || "").trim(),
      parentName: (parentName || "").trim(),
      parentPhone: (parentPhone || "").trim(),
    });
    res.status(201).json({ id: String(student._id) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "That student ID is already in use in this school." });
    res.status(500).json({ error: "Unable to create student." });
  }
});

app.put("/api/admin/students/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, name, className, section, rollNumber, parentName, parentPhone } = req.body;
    if (!userId?.trim() || !name?.trim()) return res.status(400).json({ error: "Student ID and name are required." });
    const normalizedUserId = userId.trim().toLowerCase();
    if (await loginIdIsInUse(normalizedUserId, { schoolId: req.session.schoolId, role: "student", profileId: req.params.id })) {
      return res.status(409).json({ error: "That login ID is already in use. Choose a different specific student ID." });
    }
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.session.schoolId },
      { userId: normalizedUserId, name: name.trim(), className: (className || "").trim(), section: (section || "").trim(), rollNumber: (rollNumber || "").trim(), parentName: (parentName || "").trim(), parentPhone: (parentPhone || "").trim() },
      { new: true, runValidators: true }
    );
    if (!student) return res.status(404).json({ error: "Student not found." });
    res.json({ id: String(student._id) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "That student ID is already in use in this school." });
    res.status(500).json({ error: "Unable to update student." });
  }
});

app.delete("/api/admin/students/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ _id: req.params.id, schoolId: req.session.schoolId });
    if (!student) return res.status(404).json({ error: "Student not found." });
    await deleteStudentRecords(student._id, req.session.schoolId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Unable to remove student." });
  }
});

app.put("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, address, phone, colors, teacherPassword, studentPassword } = req.body;
    const schoolId = req.session.schoolId;
    const currentSchool = await School.findById(schoolId);
    if (!currentSchool) return res.status(404).json({ error: "School not found." });
    const teacherLoginId = String(req.body.teacherLoginId ?? currentSchool.teacherLoginId ?? "").trim().toLowerCase();
    const studentLoginId = String(req.body.studentLoginId ?? currentSchool.studentLoginId ?? "").trim().toLowerCase();
    if (teacherLoginId && studentLoginId && teacherLoginId === studentLoginId) {
      return res.status(400).json({ error: "Teacher and student general login IDs must be different." });
    }
    if (teacherLoginId && await loginIdIsInUse(teacherLoginId, { schoolId, role: "teacher", allowCurrentGeneral: true })) {
      return res.status(409).json({ error: "The teacher general login ID is already assigned to another account." });
    }
    if (studentLoginId && await loginIdIsInUse(studentLoginId, { schoolId, role: "student", allowCurrentGeneral: true })) {
      return res.status(409).json({ error: "The student general login ID is already assigned to another account." });
    }
    const updates = {
      name: (name || "").trim(),
      address: (address || "").trim(),
      phone: (phone || "").trim(),
      ...(req.body.email !== undefined ? { email: String(req.body.email).trim().toLowerCase() } : {}),
      ...(req.body.logo !== undefined ? { logo: req.body.logo } : {}),
      ...(req.body.currency !== undefined ? { currency: String(req.body.currency || "PKR").trim().toUpperCase() } : {}),
      ...(req.body.timezone !== undefined ? { timezone: String(req.body.timezone || "Asia/Karachi").trim() } : {}),
      ...(req.body.academicYear !== undefined ? { academicYear: String(req.body.academicYear).trim() } : {}),
      ...(req.body.gradingSystem !== undefined ? { gradingSystem: req.body.gradingSystem } : {}),
      ...(req.body.settings !== undefined ? { settings: req.body.settings } : {}),
      teacherLoginId,
      studentLoginId,
      ...(colors && typeof colors === "object" ? { colors } : {}),
      ...(teacherPassword ? { teacherPasswordHash: await hashPassword(teacherPassword) } : {}),
      ...(studentPassword ? { studentPasswordHash: await hashPassword(studentPassword) } : {}),
    };
    const school = await School.findByIdAndUpdate(schoolId, updates, { new: true, runValidators: true });
    if (!school) return res.status(404).json({ error: "School not found." });
    await writeAudit(req, "school.settings.updated", "school", school._id);
    res.json({ school: { id: String(school._id), name: school.name, address: school.address, phone: school.phone, email: school.email, logo: school.logo, currency: school.currency, timezone: school.timezone, academicYear: school.academicYear, gradingSystem: school.gradingSystem, settings: school.settings, colors: school.colors, teacherLoginId: school.teacherLoginId, studentLoginId: school.studentLoginId } });
  } catch (err) {
    res.status(500).json({ error: "Unable to save school settings." });
  }
});

// Admin academic setup and operational controls.
app.get("/api/admin/classes", requireAuth, requireAdmin, async (req, res) => {
  const rows = await Classroom.find({ schoolId: req.session.schoolId }).sort({ className: 1, section: 1 });
  res.json(rows.map(publicRecord));
});

app.post("/api/admin/classes", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { className, section, subjects, teacherIds, academicYear } = req.body;
    if (!String(className || "").trim()) return res.status(400).json({ error: "Class name is required." });
    const ids = Array.isArray(teacherIds) ? teacherIds : [];
    const teachers = ids.length ? await Teacher.countDocuments({ _id: { $in: ids }, schoolId: req.session.schoolId }) : 0;
    if (teachers !== ids.length) return res.status(400).json({ error: "One or more assigned teachers do not belong to this school." });
    const row = await Classroom.create({ schoolId: req.session.schoolId, className: String(className).trim(), section: String(section || "").trim(), subjects: Array.isArray(subjects) ? subjects.map((item) => String(item).trim()).filter(Boolean) : [], teacherIds: ids, academicYear: String(academicYear || "").trim() });
    await writeAudit(req, "class.created", "class", row._id);
    res.status(201).json(publicRecord(row));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "That class and section already exist." });
    res.status(500).json({ error: "Unable to create class." });
  }
});

app.put("/api/admin/classes/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { className, section, subjects, teacherIds, academicYear, active } = req.body;
    if (!String(className || "").trim()) return res.status(400).json({ error: "Class name is required." });
    const ids = Array.isArray(teacherIds) ? teacherIds : [];
    const teachers = ids.length ? await Teacher.countDocuments({ _id: { $in: ids }, schoolId: req.session.schoolId }) : 0;
    if (teachers !== ids.length) return res.status(400).json({ error: "One or more assigned teachers do not belong to this school." });
    const row = await Classroom.findOneAndUpdate({ _id: req.params.id, schoolId: req.session.schoolId }, { className: String(className).trim(), section: String(section || "").trim(), subjects: Array.isArray(subjects) ? subjects.map((item) => String(item).trim()).filter(Boolean) : [], teacherIds: ids, academicYear: String(academicYear || "").trim(), ...(typeof active === "boolean" ? { active } : {}) }, { new: true, runValidators: true });
    if (!row) return res.status(404).json({ error: "Class not found." });
    await writeAudit(req, "class.updated", "class", row._id);
    res.json(publicRecord(row));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "That class and section already exist." });
    res.status(500).json({ error: "Unable to update class." });
  }
});

app.delete("/api/admin/classes/:id", requireAuth, requireAdmin, async (req, res) => {
  const row = await Classroom.findOneAndUpdate({ _id: req.params.id, schoolId: req.session.schoolId }, { active: false }, { new: true });
  if (!row) return res.status(404).json({ error: "Class not found." });
  await writeAudit(req, "class.deactivated", "class", row._id);
  res.json({ ok: true });
});

app.get("/api/admin/timetable", requireAuth, requireAdmin, async (req, res) => {
  const rows = await TimetableItem.find({ schoolId: req.session.schoolId }).populate("teacherId", "inchargeName").sort({ weekday: 1, startTime: 1 });
  res.json(rows.map((row) => ({ ...publicRecord(row), teacherName: row.teacherId?.inchargeName || "" })));
});

app.post("/api/admin/timetable", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { className, section, subject, teacherId, weekday, startTime, endTime, room } = req.body;
    if (!String(className || "").trim() || !String(subject || "").trim() || !/^\d{2}:\d{2}$/.test(startTime || "") || !/^\d{2}:\d{2}$/.test(endTime || "") || startTime >= endTime || !Number.isInteger(Number(weekday)) || Number(weekday) < 0 || Number(weekday) > 6) return res.status(400).json({ error: "Enter a class, subject, valid weekday and time range." });
    if (teacherId && !await Teacher.exists({ _id: teacherId, schoolId: req.session.schoolId })) return res.status(400).json({ error: "Teacher does not belong to this school." });
    const overlap = await TimetableItem.findOne({ schoolId: req.session.schoolId, weekday: Number(weekday), startTime: { $lt: endTime }, endTime: { $gt: startTime }, $or: [{ className, section: section || "" }, ...(teacherId ? [{ teacherId }] : [])] });
    if (overlap) return res.status(409).json({ error: "That time overlaps another class or teacher timetable entry." });
    const row = await TimetableItem.create({ schoolId: req.session.schoolId, className: String(className).trim(), section: String(section || "").trim(), subject: String(subject).trim(), teacherId: teacherId || null, weekday: Number(weekday), startTime, endTime, room: String(room || "").trim() });
    await writeAudit(req, "timetable.created", "timetable", row._id);
    res.status(201).json(publicRecord(row));
  } catch (err) { res.status(500).json({ error: "Unable to create timetable entry." }); }
});

app.put("/api/admin/timetable/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { className, section, subject, teacherId, weekday, startTime, endTime, room } = req.body;
    if (!String(className || "").trim() || !String(subject || "").trim() || !/^\d{2}:\d{2}$/.test(startTime || "") || !/^\d{2}:\d{2}$/.test(endTime || "") || startTime >= endTime || !Number.isInteger(Number(weekday)) || Number(weekday) < 0 || Number(weekday) > 6) return res.status(400).json({ error: "Enter a class, subject, valid weekday and time range." });
    if (teacherId && !await Teacher.exists({ _id: teacherId, schoolId: req.session.schoolId })) return res.status(400).json({ error: "Teacher does not belong to this school." });
    const row = await TimetableItem.findOneAndUpdate({ _id: req.params.id, schoolId: req.session.schoolId }, { className: String(className).trim(), section: String(section || "").trim(), subject: String(subject).trim(), teacherId: teacherId || null, weekday: Number(weekday), startTime, endTime, room: String(room || "").trim() }, { new: true, runValidators: true });
    if (!row) return res.status(404).json({ error: "Timetable entry not found." });
    await writeAudit(req, "timetable.updated", "timetable", row._id);
    res.json(publicRecord(row));
  } catch { res.status(400).json({ error: "Unable to update timetable entry." }); }
});

app.delete("/api/admin/timetable/:id", requireAuth, requireAdmin, async (req, res) => {
  const row = await TimetableItem.findOneAndDelete({ _id: req.params.id, schoolId: req.session.schoolId });
  if (!row) return res.status(404).json({ error: "Timetable entry not found." });
  await writeAudit(req, "timetable.deleted", "timetable", row._id);
  res.json({ ok: true });
});

app.get("/api/admin/calendar", requireAuth, requireAdmin, async (req, res) => {
  const rows = await CalendarEvent.find({ schoolId: req.session.schoolId }).sort({ startDate: 1 });
  res.json(rows.map(publicRecord));
});

app.post("/api/admin/calendar", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, kind, startDate, endDate, description } = req.body;
    if (!String(title || "").trim() || !/^\d{4}-\d{2}-\d{2}$/.test(startDate || "")) return res.status(400).json({ error: "Event title and a valid start date are required." });
    const row = await CalendarEvent.create({ schoolId: req.session.schoolId, title: String(title).trim(), kind: kind || "event", startDate, endDate: endDate || startDate, description: String(description || "").trim() });
    await writeAudit(req, "calendar.created", "calendarEvent", row._id);
    res.status(201).json(publicRecord(row));
  } catch (err) { res.status(400).json({ error: "Unable to create calendar event." }); }
});

app.put("/api/admin/calendar/:id", requireAuth, requireAdmin, async (req, res) => {
  const { title, kind, startDate, endDate, description } = req.body;
  if (!String(title || "").trim() || !/^\d{4}-\d{2}-\d{2}$/.test(startDate || "")) return res.status(400).json({ error: "Event title and a valid start date are required." });
  try {
    const row = await CalendarEvent.findOneAndUpdate({ _id: req.params.id, schoolId: req.session.schoolId }, { title: String(title).trim(), kind: kind || "event", startDate, endDate: endDate || startDate, description: String(description || "").trim() }, { new: true, runValidators: true });
    if (!row) return res.status(404).json({ error: "Calendar event not found." });
    await writeAudit(req, "calendar.updated", "calendarEvent", row._id);
    res.json(publicRecord(row));
  } catch { res.status(400).json({ error: "Unable to update calendar event." }); }
});

app.delete("/api/admin/calendar/:id", requireAuth, requireAdmin, async (req, res) => {
  const row = await CalendarEvent.findOneAndDelete({ _id: req.params.id, schoolId: req.session.schoolId });
  if (!row) return res.status(404).json({ error: "Calendar event not found." });
  await writeAudit(req, "calendar.deleted", "calendarEvent", row._id);
  res.json({ ok: true });
});

app.get("/api/admin/exams", requireAuth, requireAdmin, async (req, res) => {
  const rows = await Exam.find({ schoolId: req.session.schoolId }).sort({ date: 1, startTime: 1 });
  res.json(rows.map(publicRecord));
});

app.post("/api/admin/exams", requireAuth, requireAdmin, async (req, res) => {
  try {
    const row = await createExam(req.body, req.session.schoolId);
    await writeAudit(req, "exam.created", "exam", row._id);
    res.status(201).json(publicRecord(row));
  } catch (err) { res.status(400).json({ error: err.message || "Unable to schedule exam." }); }
});

app.put("/api/admin/exams/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, type, className, section, subject, date, startTime, endTime, room, maxMarks, instructions, status } = req.body;
    if (!String(title || "").trim() || !String(className || "").trim() || !String(subject || "").trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return res.status(400).json({ error: "Exam title, class, subject and valid date are required." });
    const row = await Exam.findOneAndUpdate({ _id: req.params.id, schoolId: req.session.schoolId }, { title: String(title).trim(), type: type || "unit", className: String(className).trim(), section: String(section || "").trim(), subject: String(subject).trim(), date, startTime: startTime || "", endTime: endTime || "", room: String(room || "").trim(), maxMarks: Number(maxMarks) || 100, instructions: String(instructions || "").trim(), status: status || "scheduled" }, { new: true, runValidators: true });
    if (!row) return res.status(404).json({ error: "Exam not found." });
    await writeAudit(req, "exam.updated", "exam", row._id);
    res.json(publicRecord(row));
  } catch (err) { res.status(400).json({ error: "Unable to update exam." }); }
});

app.delete("/api/admin/exams/:id", requireAuth, requireAdmin, async (req, res) => {
  const row = await Exam.findOneAndDelete({ _id: req.params.id, schoolId: req.session.schoolId });
  if (!row) return res.status(404).json({ error: "Exam not found." });
  await writeAudit(req, "exam.deleted", "exam", row._id);
  res.json({ ok: true });
});

app.get("/api/admin/fees", requireAuth, requireAdmin, async (req, res) => {
  const rows = await FeeInvoice.find({ schoolId: req.session.schoolId }).populate("studentId", "name userId className section rollNumber").sort({ dueDate: 1 });
  res.json(rows.map(feeSummary));
});

app.post("/api/admin/fees", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { studentId, head, amount, discount, dueDate, notes } = req.body;
    const value = Number(amount);
    if (!studentId || !String(head || "").trim() || !Number.isFinite(value) || value <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate || "")) return res.status(400).json({ error: "Student, fee head, positive amount and due date are required." });
    if (Number(discount || 0) < 0 || Number(discount || 0) >= value) return res.status(400).json({ error: "Discount must be less than the invoice amount." });
    const student = await Student.findOne({ _id: studentId, schoolId: req.session.schoolId });
    if (!student) return res.status(404).json({ error: "Student not found." });
    const invoiceNumber = `SF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const invoice = await FeeInvoice.create({ schoolId: req.session.schoolId, studentId, invoiceNumber, head: String(head).trim(), amount: value, discount: Number(discount || 0), currency: (await School.findById(req.session.schoolId))?.currency || "PKR", dueDate, notes: String(notes || "").trim() });
    await writeAudit(req, "fee.invoice.created", "feeInvoice", invoice._id, { amount: value });
    res.status(201).json(feeSummary(invoice));
  } catch (err) { res.status(500).json({ error: "Unable to create fee invoice." }); }
});

app.post("/api/admin/fees/:id/payments", requireAuth, requireAdmin, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Payment amount must be greater than zero." });
    const invoice = await FeeInvoice.findOne({ _id: req.params.id, schoolId: req.session.schoolId });
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    const outstanding = invoice.amount - invoice.discount - invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (amount > outstanding) return res.status(400).json({ error: "Payment exceeds the outstanding balance." });
    invoice.payments.push({ amount, paidAt: req.body.paidAt || new Date().toISOString().slice(0, 10), method: req.body.method || "cash", reference: String(req.body.reference || "").trim(), recordedBy: req.session.userId });
    await invoice.save();
    await writeAudit(req, "fee.payment.recorded", "feeInvoice", invoice._id, { amount });
    res.json(feeSummary(invoice));
  } catch (err) { res.status(400).json({ error: "Unable to record payment." }); }
});

app.patch("/api/admin/teachers/:id/active", requireAuth, requireAdmin, async (req, res) => {
  const row = await Teacher.findOneAndUpdate({ _id: req.params.id, schoolId: req.session.schoolId }, { active: req.body.active === true }, { new: true });
  if (!row) return res.status(404).json({ error: "Teacher not found." });
  await writeAudit(req, row.active ? "teacher.activated" : "teacher.suspended", "teacher", row._id);
  res.json({ id: String(row._id), active: row.active });
});

app.patch("/api/admin/students/:id/active", requireAuth, requireAdmin, async (req, res) => {
  const row = await Student.findOneAndUpdate({ _id: req.params.id, schoolId: req.session.schoolId }, { active: req.body.active === true }, { new: true });
  if (!row) return res.status(404).json({ error: "Student not found." });
  await writeAudit(req, row.active ? "student.activated" : "student.suspended", "student", row._id);
  res.json({ id: String(row._id), active: row.active });
});

app.get("/api/admin/audit", requireAuth, requireAdmin, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const rows = await AuditLog.find({ schoolId: req.session.schoolId }).sort({ createdAt: -1 }).limit(limit);
  res.json(rows.map(publicRecord));
});

app.get("/api/admin/reports/summary", requireAuth, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.session.schoolId;
    const [students, teachers, classes, attendance, grades, invoices] = await Promise.all([
      Student.countDocuments({ schoolId, active: { $ne: false } }),
      Teacher.countDocuments({ schoolId, active: { $ne: false } }),
      Classroom.countDocuments({ schoolId, active: true }),
      Attendance.find({ schoolId }).select("records").lean(),
      Grade.find({ schoolId }).select("marks maxMarks").lean(),
      FeeInvoice.find({ schoolId }).select("amount discount payments").lean(),
    ]);
    const marks = attendance.flatMap((day) => day.records || []);
    const paid = invoices.reduce((sum, invoice) => sum + invoice.payments.reduce((sub, payment) => sub + payment.amount, 0), 0);
    const billed = invoices.reduce((sum, invoice) => sum + invoice.amount - invoice.discount, 0);
    res.json({ students, teachers, classes, attendanceRate: marks.length ? Math.round(marks.filter((item) => item.status === "present").length * 100 / marks.length) : null, gradeAverage: grades.length ? Math.round(grades.reduce((sum, item) => sum + (item.marks / item.maxMarks) * 100, 0) / grades.length) : null, feesCollected: paid, feesOutstanding: Math.max(0, billed - paid), invoices: invoices.length });
  } catch (err) { res.status(500).json({ error: "Unable to build school summary report." }); }
});

app.post("/api/admin/import/students", requireAuth, requireAdmin, async (req, res) => {
  try {
    const records = Array.isArray(req.body.records) ? req.body.records : parseCsv(String(req.body.csv || ""));
    if (!records.length) return res.status(400).json({ error: "Provide CSV rows or a records array." });
    const results = { created: 0, skipped: [] };
    for (const record of records) {
      const userId = String(record.userId || "").trim().toLowerCase();
      const name = String(record.name || "").trim();
      if (!userId || !name || await loginIdIsInUse(userId, { schoolId: req.session.schoolId, role: "student" })) { results.skipped.push({ userId, reason: "Missing ID/name or login ID already in use." }); continue; }
      try {
        await Student.create({ schoolId: req.session.schoolId, userId, name, className: String(record.className || "").trim(), section: String(record.section || "").trim(), rollNumber: String(record.rollNumber || "").trim(), parentName: String(record.parentName || "").trim(), parentPhone: String(record.parentPhone || "").trim(), email: String(record.email || "").trim().toLowerCase(), phone: String(record.phone || "").trim() });
        results.created += 1;
      } catch { results.skipped.push({ userId, reason: "Could not create record (duplicate or invalid data)." }); }
    }
    await writeAudit(req, "student.bulk_import", "student", "", { created: results.created, skipped: results.skipped.length });
    res.json(results);
  } catch (err) { res.status(400).json({ error: "Unable to import student data." }); }
});

// ---------------------------------------------------------------------
// Teacher and student LMS APIs. Profile-bound sessions are deliberately
// required for personal data; a role-wide shared ID is not a person.
// ---------------------------------------------------------------------
app.get("/api/teacher/overview", requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req);
    if (!teacher) return res.status(404).json({ error: "Teacher account not found." });
    const classFilter = { schoolId: req.session.schoolId, className: teacher.className, section: teacher.section };
    const [school, students, homework, grades, materials] = await Promise.all([
      School.findById(req.session.schoolId),
      Student.find({ ...classFilter, active: { $ne: false } }).sort({ rollNumber: 1, name: 1 }),
      Homework.find({ ...classFilter, teacherId: teacher._id }).sort({ createdAt: -1 }).limit(50),
      Grade.find({ schoolId: req.session.schoolId, teacherId: teacher._id }).sort({ createdAt: -1 }).limit(50),
      Material.find({ ...classFilter, teacherId: teacher._id }).sort({ createdAt: -1 }).limit(50),
    ]);
    res.json({
      school: school && { id: String(school._id), name: school.name, address: school.address, phone: school.phone, colors: school.colors, leftLogo: school.leftLogo, rightLogo: school.rightLogo },
      teacher: { id: String(teacher._id), userId: teacher.userId || "", name: teacher.inchargeName, className: teacher.className, section: teacher.section, subjects: teacher.subjects },
      students: students.map(publicRecord),
      homework: homework.map(publicRecord),
      grades: grades.map(publicRecord),
      materials: materials.map(publicRecord),
    });
  } catch (err) {
    console.error("GET /api/teacher/overview failed:", err);
    res.status(500).json({ error: "Unable to load the teacher workspace." });
  }
});

app.get("/api/teacher/attendance", requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req);
    if (!teacher) return res.status(404).json({ error: "Teacher account not found." });
    const date = String(req.query.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "A valid attendance date is required." });
    const [students, record] = await Promise.all([
      Student.find({ schoolId: req.session.schoolId, className: teacher.className, section: teacher.section, active: { $ne: false } }).sort({ rollNumber: 1, name: 1 }),
      Attendance.findOne({ schoolId: req.session.schoolId, teacherId: teacher._id, date }),
    ]);
    res.json({ students: students.map(publicRecord), record: record ? publicRecord(record) : null });
  } catch (err) {
    res.status(500).json({ error: "Unable to load attendance." });
  }
});

app.post("/api/teacher/attendance", requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req);
    if (!teacher) return res.status(404).json({ error: "Teacher account not found." });
    const date = String(req.body.date || "").trim();
    const records = Array.isArray(req.body.records) ? req.body.records : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !records) return res.status(400).json({ error: "A valid date and attendance records are required." });
    const allowedStatuses = new Set(["present", "absent", "late", "half-day", "leave"]);
    if (records.some((record) => !record.studentId || !allowedStatuses.has(record.status))) {
      return res.status(400).json({ error: "Each attendance record needs a student and a valid status." });
    }
    const studentIds = [...new Set(records.map((record) => String(record.studentId)))];
    const validStudents = await Student.find({
      _id: { $in: studentIds }, schoolId: req.session.schoolId,
      className: teacher.className, section: teacher.section, active: { $ne: false },
    }).select("_id");
    if (validStudents.length !== studentIds.length) return res.status(403).json({ error: "Attendance can only be changed for students in your assigned class." });
    const saved = await Attendance.findOneAndUpdate(
      { schoolId: req.session.schoolId, teacherId: teacher._id, date },
      { schoolId: req.session.schoolId, teacherId: teacher._id, className: teacher.className, section: teacher.section, date, records },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json(publicRecord(saved));
  } catch (err) {
    console.error("POST /api/teacher/attendance failed:", err);
    res.status(500).json({ error: "Unable to save attendance." });
  }
});

app.post("/api/teacher/grades", requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req);
    if (!teacher) return res.status(404).json({ error: "Teacher account not found." });
    const { studentId, subject, assessment, marks, maxMarks, term, feedback } = req.body;
    const score = Number(marks);
    const maximum = Number(maxMarks);
    if (!studentId || !String(subject || "").trim() || !String(assessment || "").trim() || !Number.isFinite(score) || !Number.isFinite(maximum) || maximum <= 0 || score < 0 || score > maximum) {
      return res.status(400).json({ error: "Enter a student, subject, assessment, and valid marks." });
    }
    const student = await Student.findOne({ _id: studentId, schoolId: req.session.schoolId, className: teacher.className, section: teacher.section, active: { $ne: false } });
    if (!student) return res.status(403).json({ error: "Grades can only be added for students in your assigned class." });
    const grade = await Grade.create({ schoolId: req.session.schoolId, teacherId: teacher._id, studentId: student._id, subject: String(subject).trim(), assessment: String(assessment).trim(), marks: score, maxMarks: maximum, term: String(term || "Current term").trim(), feedback: String(feedback || "").trim(), date: new Date().toISOString().slice(0, 10) });
    res.status(201).json(publicRecord(grade));
  } catch (err) {
    console.error("POST /api/teacher/grades failed:", err);
    res.status(500).json({ error: "Unable to save grade." });
  }
});

app.post("/api/teacher/homework", requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req);
    if (!teacher) return res.status(404).json({ error: "Teacher account not found." });
    const { subject, title, description, dueDate, attachmentUrl, attachmentData, attachmentName } = req.body;
    if (!String(subject || "").trim() || !String(title || "").trim()) return res.status(400).json({ error: "Subject and title are required." });
    const homework = await Homework.create({ schoolId: req.session.schoolId, teacherId: teacher._id, className: teacher.className, section: teacher.section, subject: String(subject).trim(), title: String(title).trim(), description: String(description || "").trim(), dueDate: String(dueDate || ""), attachmentUrl: String(attachmentUrl || ""), attachmentData: String(attachmentData || ""), attachmentName: String(attachmentName || "") });
    res.status(201).json(publicRecord(homework));
  } catch (err) {
    console.error("POST /api/teacher/homework failed:", err);
    res.status(500).json({ error: "Unable to publish homework." });
  }
});

app.post("/api/teacher/materials", requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req);
    if (!teacher) return res.status(404).json({ error: "Teacher account not found." });
    const { subject, title, description, url, fileData, fileName, kind } = req.body;
    if (!String(subject || "").trim() || !String(title || "").trim()) return res.status(400).json({ error: "Subject and title are required." });
    if (kind && !["material", "test"].includes(kind)) return res.status(400).json({ error: "Resource type must be material or test." });
    const material = await Material.create({ schoolId: req.session.schoolId, teacherId: teacher._id, className: teacher.className, section: teacher.section, subject: String(subject).trim(), title: String(title).trim(), description: String(description || "").trim(), url: String(url || ""), fileData: String(fileData || ""), fileName: String(fileName || ""), kind: kind || "material" });
    res.status(201).json(publicRecord(material));
  } catch (err) {
    console.error("POST /api/teacher/materials failed:", err);
    res.status(500).json({ error: "Unable to publish resource." });
  }
});

app.get("/api/teacher/schedule", requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req);
    if (!teacher) return res.status(404).json({ error: "Teacher account not found." });
    const [timetable, calendar, exams] = await Promise.all([
      TimetableItem.find({ schoolId: req.session.schoolId, teacherId: teacher._id }).sort({ weekday: 1, startTime: 1 }),
      CalendarEvent.find({ schoolId: req.session.schoolId, startDate: { $gte: new Date().toISOString().slice(0, 10) } }).sort({ startDate: 1 }).limit(100),
      Exam.find({ schoolId: req.session.schoolId, className: teacher.className, section: teacher.section, status: "scheduled" }).sort({ date: 1 }),
    ]);
    res.json({ timetable: timetable.map(publicRecord), calendar: calendar.map(publicRecord), exams: exams.map(publicRecord) });
  } catch { res.status(500).json({ error: "Unable to load teacher schedule." }); }
});

app.post("/api/teacher/exams", requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req);
    if (!teacher) return res.status(404).json({ error: "Teacher account not found." });
    const row = await createExam({ ...req.body, className: teacher.className, section: teacher.section }, req.session.schoolId, teacher._id);
    await writeAudit(req, "exam.created", "exam", row._id);
    res.status(201).json(publicRecord(row));
  } catch (err) { res.status(400).json({ error: err.message || "Unable to create exam." }); }
});

app.get("/api/teacher/assignments", requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req);
    if (!teacher) return res.status(404).json({ error: "Teacher account not found." });
    const homework = await Homework.find({ schoolId: req.session.schoolId, teacherId: teacher._id }).select("_id title subject className section dueDate");
    const ids = homework.map((item) => item._id);
    const submissions = await AssignmentSubmission.find({ schoolId: req.session.schoolId, homeworkId: { $in: ids } }).populate("studentId", "name userId rollNumber").sort({ submittedAt: -1 });
    res.json({ homework: homework.map(publicRecord), submissions: submissions.map((item) => ({ ...publicRecord(item), student: item.studentId ? { id: String(item.studentId._id), name: item.studentId.name, userId: item.studentId.userId, rollNumber: item.studentId.rollNumber } : null })) });
  } catch { res.status(500).json({ error: "Unable to load assignment submissions." }); }
});

app.patch("/api/teacher/submissions/:id/grade", requireAuth, requireTeacher, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req);
    if (!teacher) return res.status(404).json({ error: "Teacher account not found." });
    const submission = await AssignmentSubmission.findOne({ _id: req.params.id, schoolId: req.session.schoolId }).populate("homeworkId");
    if (!submission || String(submission.homeworkId.teacherId) !== String(teacher._id)) return res.status(404).json({ error: "Submission not found." });
    const marks = Number(req.body.marks);
    if (!Number.isFinite(marks) || marks < 0) return res.status(400).json({ error: "Enter a valid non-negative mark." });
    submission.marks = marks;
    submission.feedback = String(req.body.feedback || "").trim();
    submission.gradedAt = new Date();
    await submission.save();
    await writeAudit(req, "assignment.graded", "assignmentSubmission", submission._id);
    res.json(publicRecord(submission));
  } catch { res.status(500).json({ error: "Unable to grade submission." }); }
});

app.post("/api/student/assignments/:homeworkId/submissions", requireAuth, requireStudent, async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.session.studentId, schoolId: req.session.schoolId, active: { $ne: false } });
    const homework = await Homework.findOne({ _id: req.params.homeworkId, schoolId: req.session.schoolId, className: student.className, section: student.section });
    if (!homework) return res.status(404).json({ error: "Assignment not found for your class." });
    const submissionText = String(req.body.submissionText || "").trim();
    const attachmentData = String(req.body.attachmentData || "");
    if (!submissionText && !attachmentData) return res.status(400).json({ error: "Add submission text or attach a file." });
    if (attachmentData.length > 5 * 1024 * 1024) return res.status(413).json({ error: "Submission file exceeds the 5 MB limit." });
    const submission = await AssignmentSubmission.findOneAndUpdate(
      { schoolId: req.session.schoolId, homeworkId: homework._id, studentId: student._id },
      { schoolId: req.session.schoolId, homeworkId: homework._id, studentId: student._id, submissionText, attachmentData, attachmentName: String(req.body.attachmentName || ""), submittedAt: new Date(), marks: null, feedback: "", gradedAt: null },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    await writeAudit(req, "assignment.submitted", "assignmentSubmission", submission._id);
    res.json(publicRecord(submission));
  } catch { res.status(500).json({ error: "Unable to submit assignment." }); }
});

app.get("/api/student/overview", requireAuth, requireStudent, async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.session.studentId, schoolId: req.session.schoolId, active: { $ne: false } });
    if (!student) return res.status(404).json({ error: "Student account not found." });
    const classFilter = { schoolId: req.session.schoolId, className: student.className, section: student.section };
    const [school, homework, materials, grades, attendance, timetable, calendar, exams, invoices, submissions] = await Promise.all([
      School.findById(req.session.schoolId),
      Homework.find(classFilter).sort({ createdAt: -1 }).limit(100),
      Material.find(classFilter).sort({ createdAt: -1 }).limit(100),
      Grade.find({ schoolId: req.session.schoolId, studentId: student._id }).sort({ createdAt: -1 }).limit(100),
      Attendance.find({ schoolId: req.session.schoolId, "records.studentId": student._id }).sort({ date: -1 }).limit(100),
      TimetableItem.find({ ...classFilter }).populate("teacherId", "inchargeName").sort({ weekday: 1, startTime: 1 }),
      CalendarEvent.find({ schoolId: req.session.schoolId, startDate: { $gte: new Date().toISOString().slice(0, 10) } }).sort({ startDate: 1 }).limit(100),
      Exam.find({ ...classFilter, status: "scheduled" }).sort({ date: 1 }),
      FeeInvoice.find({ schoolId: req.session.schoolId, studentId: student._id }).sort({ dueDate: 1 }),
      AssignmentSubmission.find({ schoolId: req.session.schoolId, studentId: student._id }),
    ]);
    const submissionByHomework = new Map(submissions.map((submission) => [String(submission.homeworkId), submission]));
    res.json({
      school: school && { id: String(school._id), name: school.name },
      student: { ...publicRecord(student), name: student.name, className: student.className, section: student.section, userId: student.userId },
      homework: homework.map((item) => ({ ...publicRecord(item), submission: submissionByHomework.has(String(item._id)) ? publicRecord(submissionByHomework.get(String(item._id))) : null })),
      tests: materials.filter((item) => item.kind === "test").map(publicRecord),
      materials: materials.filter((item) => item.kind === "material").map(publicRecord),
      grades: grades.map(publicRecord),
      attendance: attendance.map((item) => ({ ...publicRecord(item), records: item.records.filter((record) => String(record.studentId) === String(student._id)) })),
      timetable: timetable.map((item) => ({ ...publicRecord(item), teacherName: item.teacherId?.inchargeName || "" })),
      calendar: calendar.map(publicRecord),
      exams: exams.map(publicRecord),
      fees: invoices.map(feeSummary),
    });
  } catch (err) {
    console.error("GET /api/student/overview failed:", err);
    res.status(500).json({ error: "Unable to load the student workspace." });
  }
});

// ---------------------------------------------------------------------
// Teacher routes — every one is scoped to a schoolId so each school only
// ever sees and edits its own incharges.
// ---------------------------------------------------------------------
app.get("/api/teachers", async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: "schoolId is required." });
    const teachers = await Teacher.find({ schoolId }).sort({ createdAt: 1 });
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: "Failed to load teachers." });
  }
});

app.post("/api/teachers", requireAuth, requireSchoolAdminScope, async (req, res) => {
  try {
    const { schoolId, inchargeName, className, section, subjects } = req.body;
    if (!schoolId) return res.status(400).json({ error: "schoolId is required." });
    if (!inchargeName || !inchargeName.trim()) {
      return res.status(400).json({ error: "inchargeName is required." });
    }
    const teacher = await Teacher.create({
      schoolId,
      inchargeName: inchargeName.trim(),
      className: (className || "").trim(),
      section: (section || "").trim(),
      subjects: Array.isArray(subjects) ? subjects : [],
    });
    res.status(201).json(teacher);
  } catch (err) {
    res.status(500).json({ error: "Failed to create teacher." });
  }
});

app.put("/api/teachers/:id", requireAuth, requireTeacherSchoolAdmin, async (req, res) => {
  try {
    const { inchargeName, className, section, subjects } = req.body;
    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      {
        inchargeName: (inchargeName || "").trim(),
        className: (className || "").trim(),
        section: (section || "").trim(),
        subjects: Array.isArray(subjects) ? subjects : [],
      },
      { new: true, runValidators: true }
    );
    if (!teacher) return res.status(404).json({ error: "Teacher not found." });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: "Failed to update teacher." });
  }
});

app.delete("/api/teachers/:id", requireAuth, requireTeacherSchoolAdmin, async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!teacher) return res.status(404).json({ error: "Teacher not found." });
    await deleteTeacherRecords(teacher._id, teacher.schoolId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete teacher." });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

// Global error handler — catches anything that throws before a route's own
// try/catch gets a chance, most importantly body-parser rejecting a request
// (e.g. a logo upload pushing the JSON body over the size limit, or
// malformed JSON). Without this, Express's default handler sends back a
// plain HTML error page instead of JSON, which the frontend's `request()`
// helper can't parse — so it silently falls back to a generic "Request
// failed" message with no useful detail anywhere. This must be registered
// last, after every other app.use()/route.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "That upload is too large — please use a smaller image for the logo.",
    });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed request." });
  }
  res.status(500).json({ error: `Server error: ${err.message}` });
});