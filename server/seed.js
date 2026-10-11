import "dotenv/config";
import crypto from "node:crypto";
import { promisify } from "node:util";
import mongoose from "mongoose";
import School from "./School.js";
import Teacher from "./Teacher.js";
import Student from "./Student.js";
import Classroom from "./Classroom.js";

const scrypt = promisify(crypto.scrypt);
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

const required = ["MONGODB_URI", "SEED_SCHOOL_NAME", "SEED_DIARY_CODE", "SEED_ADMIN_ID", "SEED_ADMIN_PASSWORD", "SEED_TEACHER_ID", "SEED_TEACHER_PASSWORD", "SEED_STUDENT_ID", "SEED_STUDENT_PASSWORD"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing seed environment values: ${missing.join(", ")}`);
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const adminUserId = process.env.SEED_ADMIN_ID.trim().toLowerCase();
  if (await School.exists({ adminUserId })) throw new Error("Seed admin ID already exists; refusing to overwrite data.");
  const school = await School.create({
    name: process.env.SEED_SCHOOL_NAME.trim(),
    address: process.env.SEED_SCHOOL_ADDRESS || "",
    phone: process.env.SEED_SCHOOL_PHONE || "",
    diaryCode: process.env.SEED_DIARY_CODE,
    adminUserId,
    adminPasswordHash: await hashPassword(process.env.SEED_ADMIN_PASSWORD),
    teacherLoginId: process.env.SEED_GENERAL_TEACHER_ID?.trim().toLowerCase() || "",
    studentLoginId: process.env.SEED_GENERAL_STUDENT_ID?.trim().toLowerCase() || "",
    teacherPasswordHash: await hashPassword(process.env.SEED_TEACHER_PASSWORD),
    studentPasswordHash: await hashPassword(process.env.SEED_STUDENT_PASSWORD),
    academicYear: process.env.SEED_ACADEMIC_YEAR || "",
  });
  const teacher = await Teacher.create({ schoolId: school._id, userId: process.env.SEED_TEACHER_ID.trim().toLowerCase(), inchargeName: process.env.SEED_TEACHER_NAME || "Demo Teacher", className: process.env.SEED_CLASS || "Class 1", section: process.env.SEED_SECTION || "A", subjects: ["English", "Mathematics"] });
  const student = await Student.create({ schoolId: school._id, userId: process.env.SEED_STUDENT_ID.trim().toLowerCase(), name: process.env.SEED_STUDENT_NAME || "Demo Student", className: teacher.className, section: teacher.section, rollNumber: "1" });
  await Classroom.create({ schoolId: school._id, className: teacher.className, section: teacher.section, subjects: teacher.subjects, teacherIds: [teacher._id], academicYear: school.academicYear });
  console.log(`Created seed school ${school.name}; admin ID: ${adminUserId}; teacher ID: ${teacher.userId}; student ID: ${student.userId}; student record: ${student.name}.`);
} catch (error) {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
