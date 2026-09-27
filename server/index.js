import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Teacher from "./Teacher.js";
import School from "./School.js";

const app = express();
app.use(cors());
// Raised from the default ~100kb so uploaded logos (sent as base64 data
// URIs from the Dev Portal) fit comfortably in the request body.
app.use(express.json({ limit: "10mb" }));

const { MONGODB_URI, PORT = 4000, DEV_PASSWORD } = process.env;

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
    res.json({ ok: req.body.password === school.adminPassword });
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
    res.json(schools);
  } catch (err) {
    res.status(500).json({ error: "Failed to load schools." });
  }
});

app.post("/api/dev/schools", requireDevAuth, async (req, res) => {
  try {
    const { name, address, phone, diaryCode, adminPassword, leftLogo, rightLogo } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "name is required." });
    if (!diaryCode || !diaryCode.trim())
      return res.status(400).json({ error: "diaryCode is required." });
    if (!adminPassword || !adminPassword.trim())
      return res.status(400).json({ error: "adminPassword is required." });

    const school = await School.create({
      name: name.trim(),
      address: (address || "").trim(),
      phone: (phone || "").trim(),
      diaryCode: diaryCode.trim(),
      adminPassword: adminPassword.trim(),
      // Logos are optional — a school can be added without them and have
      // them uploaded later by editing it from the Dev Portal.
      leftLogo: leftLogo || "",
      rightLogo: rightLogo || "",
    });
    res.status(201).json(school);
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
    const { name, address, phone, diaryCode, adminPassword, leftLogo, rightLogo } = req.body;
    const school = await School.findByIdAndUpdate(
      req.params.id,
      {
        name: (name || "").trim(),
        address: (address || "").trim(),
        phone: (phone || "").trim(),
        diaryCode: (diaryCode || "").trim(),
        adminPassword: (adminPassword || "").trim(),
        // leftLogo/rightLogo are only overwritten when a value is actually
        // sent, so leaving the upload fields untouched while editing other
        // details (like the address) doesn't wipe out an existing logo.
        ...(leftLogo !== undefined ? { leftLogo } : {}),
        ...(rightLogo !== undefined ? { rightLogo } : {}),
      },
      { new: true, runValidators: true }
    );
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json(school);
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