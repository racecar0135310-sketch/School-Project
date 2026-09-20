import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import School from "./School.js";
import Teacher from "./Teacher.js";

const app = express();
app.use(cors());
app.use(express.json());

const { MONGODB_URI, PORT = 4000, DEV_PASSWORD } = process.env;

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI environment variable.");
  process.exit(1);
}
if (!DEV_PASSWORD) {
  console.error(
    "Missing DEV_PASSWORD environment variable — this protects the /dev portal that manages every school. Set it before starting the server."
  );
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------
// Public school info — no secrets included. Used by the school-picker
// page and by the diary page to show the right name/logo/address.
// ---------------------------------------------------------------------
function publicSchool(s) {
  return {
    id: s._id,
    slug: s.slug,
    name: s.name,
    address: s.address,
    phone: s.phone,
    logoLeft: s.logoLeft,
    logoRight: s.logoRight,
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

app.get("/api/schools/:slug", async (req, res) => {
  try {
    const school = await School.findOne({ slug: req.params.slug });
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json(publicSchool(school));
  } catch (err) {
    res.status(500).json({ error: "Failed to load school." });
  }
});

// Check the diary-access code for one school, without ever sending the
// real code to the browser.
app.post("/api/schools/:slug/verify-code", async (req, res) => {
  try {
    const school = await School.findOne({ slug: req.params.slug });
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json({ ok: (req.body.code || "") === school.generalCode });
  } catch (err) {
    res.status(500).json({ error: "Failed to verify code." });
  }
});

// Check the admin password for one school.
app.post("/api/schools/:slug/verify-admin", async (req, res) => {
  try {
    const school = await School.findOne({ slug: req.params.slug });
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json({ ok: (req.body.password || "") === school.adminPassword });
  } catch (err) {
    res.status(500).json({ error: "Failed to verify password." });
  }
});

// ---------------------------------------------------------------------
// Teachers — scoped to one school. Every route here requires a valid
// school slug in the URL and only ever touches that school's records.
// ---------------------------------------------------------------------
async function requireSchool(req, res, next) {
  const school = await School.findOne({ slug: req.params.slug });
  if (!school) return res.status(404).json({ error: "School not found." });
  req.school = school;
  next();
}

app.get("/api/schools/:slug/teachers", requireSchool, async (req, res) => {
  try {
    const teachers = await Teacher.find({ schoolId: req.school._id }).sort({ createdAt: 1 });
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: "Failed to load teachers." });
  }
});

app.post("/api/schools/:slug/teachers", requireSchool, async (req, res) => {
  try {
    const { inchargeName, className, section, subjects } = req.body;
    if (!inchargeName || !inchargeName.trim()) {
      return res.status(400).json({ error: "inchargeName is required." });
    }
    const teacher = await Teacher.create({
      schoolId: req.school._id,
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

app.put("/api/schools/:slug/teachers/:id", requireSchool, async (req, res) => {
  try {
    const { inchargeName, className, section, subjects } = req.body;
    const teacher = await Teacher.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.school._id },
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

app.delete("/api/schools/:slug/teachers/:id", requireSchool, async (req, res) => {
  try {
    const teacher = await Teacher.findOneAndDelete({
      _id: req.params.id,
      schoolId: req.school._id,
    });
    if (!teacher) return res.status(404).json({ error: "Teacher not found." });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete teacher." });
  }
});

// ---------------------------------------------------------------------
// Dev portal — manages every school, including its codes/passwords.
// Every request must carry the correct dev password in a header, checked
// server-side against DEV_PASSWORD (never shipped to the browser).
// ---------------------------------------------------------------------
app.post("/api/dev/login", (req, res) => {
  res.json({ ok: (req.body.password || "") === DEV_PASSWORD });
});

function requireDev(req, res, next) {
  if (req.header("x-dev-password") !== DEV_PASSWORD) {
    return res.status(401).json({ error: "Not authorized." });
  }
  next();
}

app.get("/api/dev/schools", requireDev, async (req, res) => {
  try {
    const schools = await School.find().sort({ name: 1 });
    res.json(schools); // full records here, including codes — dev-only
  } catch (err) {
    res.status(500).json({ error: "Failed to load schools." });
  }
});

app.post("/api/dev/schools", requireDev, async (req, res) => {
  try {
    const { slug, name, address, phone, logoLeft, logoRight, generalCode, adminPassword } =
      req.body;
    if (!slug || !name || !generalCode || !adminPassword) {
      return res
        .status(400)
        .json({ error: "slug, name, generalCode and adminPassword are all required." });
    }
    const school = await School.create({
      slug: slug.trim().toLowerCase(),
      name: name.trim(),
      address: (address || "").trim(),
      phone: (phone || "").trim(),
      logoLeft: (logoLeft || "").trim(),
      logoRight: (logoRight || "").trim(),
      generalCode: generalCode.trim(),
      adminPassword: adminPassword.trim(),
    });
    res.status(201).json(school);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "That slug is already in use by another school." });
    }
    res.status(500).json({ error: "Failed to create school." });
  }
});

app.put("/api/dev/schools/:id", requireDev, async (req, res) => {
  try {
    const { slug, name, address, phone, logoLeft, logoRight, generalCode, adminPassword } =
      req.body;
    const school = await School.findByIdAndUpdate(
      req.params.id,
      {
        slug: (slug || "").trim().toLowerCase(),
        name: (name || "").trim(),
        address: (address || "").trim(),
        phone: (phone || "").trim(),
        logoLeft: (logoLeft || "").trim(),
        logoRight: (logoRight || "").trim(),
        generalCode: (generalCode || "").trim(),
        adminPassword: (adminPassword || "").trim(),
      },
      { new: true, runValidators: true }
    );
    if (!school) return res.status(404).json({ error: "School not found." });
    res.json(school);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "That slug is already in use by another school." });
    }
    res.status(500).json({ error: "Failed to update school." });
  }
});

app.delete("/api/dev/schools/:id", requireDev, async (req, res) => {
  try {
    const school = await School.findByIdAndDelete(req.params.id);
    if (!school) return res.status(404).json({ error: "School not found." });
    await Teacher.deleteMany({ schoolId: school._id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete school." });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});