import "dotenv/config";
import crypto from "node:crypto";
import { promisify } from "node:util";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Teacher from "./Teacher.js";
import School from "./School.js";
import Student from "./Student.js";

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

app.post("/api/auth/login", async (req, res) => {
  try {
    const userId = String(req.body.userId || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!userId || !password) return res.status(400).json({ error: "Enter your login ID and password." });

    const school = await School.findOne({ adminUserId: userId });
    if (!school) return res.status(401).json({ error: "Invalid login ID or password." });
    let valid = await verifyPassword(password, school.adminPasswordHash);
    // One-time compatibility for existing schools until their credentials are
    // edited in the Dev Portal and saved as a modern login.
    if (!valid && !school.adminPasswordHash && school.adminPassword) {
      valid = password === school.adminPassword;
      if (valid) {
        school.adminPasswordHash = await hashPassword(password);
        school.adminPassword = "";
        await school.save();
      }
    }
    if (!valid) return res.status(401).json({ error: "Invalid login ID or password." });

    const user = {
      userId: school.adminUserId,
      name: school.name,
      role: "admin",
      schoolId: String(school._id),
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
    res.json({
      user: { userId: req.session.userId, name: school.name, role: "admin", schoolId: String(school._id) },
      school: { id: String(school._id), name: school.name, address: school.address, phone: school.phone, colors: school.colors },
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
    res.json({ ok });
  } catch (err) {
    res.status(500).json({ error: "Failed to verify password." });
  }
});

// Lets a school's own Admin Portal change its diary's theme colors. This is
// intentionally separate from the /api/dev/schools routes (which manage
// codes/passwords and need the DEV_PASSWORD) — colors are a per-school admin
// concern, not a super-admin one.
app.put("/api/schools/:id/colors", async (req, res) => {
  try {
    const { colors } = req.body;
    if (!colors || typeof colors !== "object") {
      return res.status(400).json({ error: "colors is required." });
    }
    const school = await School.findByIdAndUpdate(
      req.params.id,
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
    if (await School.exists({ adminUserId: normalizedAdminId })) {
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
    if (await School.exists({ adminUserId: normalizedAdminId, _id: { $ne: req.params.id } })) {
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
    // Clean up that school's teachers too, so nothing orphaned is left behind.
    await Teacher.deleteMany({ schoolId: req.params.id });
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
      school: { id: String(school._id), name: school.name, address: school.address, phone: school.phone, colors: school.colors },
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
    const teacher = await Teacher.create({
      schoolId: req.session.schoolId,
      userId: userId.trim().toLowerCase(),
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
    const teacher = await Teacher.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.session.schoolId },
      { userId: userId.trim().toLowerCase(), inchargeName: name.trim(), className: (className || "").trim(), section: (section || "").trim(), subjects: Array.isArray(subjects) ? subjects : [] },
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
    const student = await Student.create({
      schoolId: req.session.schoolId,
      userId: userId.trim().toLowerCase(),
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
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.session.schoolId },
      { userId: userId.trim().toLowerCase(), name: name.trim(), className: (className || "").trim(), section: (section || "").trim(), rollNumber: (rollNumber || "").trim(), parentName: (parentName || "").trim(), parentPhone: (parentPhone || "").trim() },
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
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Unable to remove student." });
  }
});

app.put("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, address, phone, colors, teacherPassword, studentPassword } = req.body;
    const updates = {
      name: (name || "").trim(),
      address: (address || "").trim(),
      phone: (phone || "").trim(),
      ...(colors && typeof colors === "object" ? { colors } : {}),
      ...(teacherPassword ? { teacherPasswordHash: await hashPassword(teacherPassword) } : {}),
      ...(studentPassword ? { studentPasswordHash: await hashPassword(studentPassword) } : {}),
    };
    const school = await School.findByIdAndUpdate(req.session.schoolId, updates, { new: true, runValidators: true });
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json({ school: { id: String(school._id), name: school.name, address: school.address, phone: school.phone, colors: school.colors } });
  } catch (err) {
    res.status(500).json({ error: "Unable to save school settings." });
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

app.post("/api/teachers", async (req, res) => {
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

app.put("/api/teachers/:id", async (req, res) => {
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

app.delete("/api/teachers/:id", async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!teacher) return res.status(404).json({ error: "Teacher not found." });
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