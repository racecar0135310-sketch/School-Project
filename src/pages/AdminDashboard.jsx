import React, { useEffect, useMemo, useState } from "react";
import {
  addAdminStudent,
  addAdminTeacher,
  editAdminStudent,
  editAdminTeacher,
  getAdminStudents,
  getAdminSummary,
  getAdminTeachers,
  removeAdminStudent,
  removeAdminTeacher,
  saveAdminSettings,
} from "../lib/storage.js";
import { DEFAULT_COLORS } from "../lib/colors.js";
import { EmptyState, Field, LoadingState, Notice, PageIntro, Panel, PrimaryButton, SecondaryButton, SelectField, StatCard, StatusPill } from "../components/LmsUi.jsx";

const blankTeacher = { userId: "", name: "", className: "", section: "", subjects: "" };
const blankStudent = { userId: "", name: "", className: "", section: "", rollNumber: "", parentName: "", parentPhone: "" };

export default function AdminDashboard({ view }) {
  const [summary, setSummary] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [school, setSchool] = useState(null);
  const [settings, setSettings] = useState({ name: "", address: "", phone: "", teacherPassword: "", studentPassword: "", colors: DEFAULT_COLORS });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([getAdminSummary(), getAdminTeachers(), getAdminStudents()])
      .then(([nextSummary, nextTeachers, nextStudents]) => {
        if (!alive) return;
        setSummary(nextSummary);
        setSchool(nextSummary.school);
        setSettings((current) => ({ ...current, name: nextSummary.school?.name || "", address: nextSummary.school?.address || "", phone: nextSummary.school?.phone || "", colors: nextSummary.school?.colors || DEFAULT_COLORS }));
        setTeachers(nextTeachers);
        setStudents(nextStudents);
      })
      .catch((err) => alive && setError(err.message || "Unable to load the admin workspace."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const refreshPeople = async () => {
    const [nextTeachers, nextStudents, nextSummary] = await Promise.all([getAdminTeachers(), getAdminStudents(), getAdminSummary()]);
    setTeachers(nextTeachers); setStudents(nextStudents); setSummary(nextSummary); setSchool(nextSummary.school);
  };
  const flash = (message) => { setNotice(message); window.setTimeout(() => setNotice(""), 3500); };

  if (loading) return <LoadingState />;
  if (error && !summary) return <Notice>{error}</Notice>;

  return <div>
    {error && <div className="mb-5"><Notice>{error}</Notice></div>}
    {notice && <div className="mb-5"><Notice type="success">{notice}</Notice></div>}
    {view === "overview" && <AdminOverview summary={summary} teachers={teachers} students={students} />}
    {view === "teachers" && <TeacherManagement teachers={teachers} onRefresh={refreshPeople} onFlash={flash} />}
    {view === "students" && <StudentManagement students={students} onRefresh={refreshPeople} onFlash={flash} />}
    {view === "settings" && <SettingsPanel school={school} settings={settings} setSettings={setSettings} onSaved={(next) => { setSchool(next.school); setSettings((current) => ({ ...current, ...next.school, colors: next.school.colors || current.colors, teacherPassword: "", studentPassword: "" })); flash("School settings saved."); }} />}
  </div>;
}

function AdminOverview({ summary, teachers, students }) {
  const recentTeachers = teachers.slice(-4).reverse();
  return <>
    <PageIntro eyebrow="Admin workspace" title={`Good morning, ${summary?.school?.name || "Admin"}.`} description="A quick view of your school's people and active learning groups." action={<StatusPill tone="green">School account active</StatusPill>} />
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5"><StatCard label="Total students" value={summary?.students ?? students.length} detail="Active student accounts" icon="♧" tone="blue" /><StatCard label="Teachers" value={summary?.teachers ?? teachers.length} detail="Teaching accounts" icon="♙" tone="green" /><StatCard label="Active classes" value={summary?.classes ?? "—"} detail="Classes with students" icon="▦" tone="orange" /><StatCard label="School status" value="Live" detail="Portal is ready to use" icon="✓" tone="violet" /></div>
    <div className="mt-6 grid xl:grid-cols-[1.2fr_.8fr] gap-5"><Panel title="Getting started" description="A simple order for setting up the school." ><div className="space-y-4"><Step number="01" title="Set shared passwords" text="Choose the teacher and student passwords in School settings." done={Boolean(summary)} /><Step number="02" title="Add your teachers" text="Give each teacher a memorable ID and assign their class." done={teachers.length > 0} /><Step number="03" title="Add students" text="Create student IDs so learners can sign in without selecting a school." done={students.length > 0} /></div></Panel><Panel title="Teacher directory" description="Your newest teaching accounts."><div className="space-y-3">{recentTeachers.length ? recentTeachers.map((teacher) => <div key={teacher.id} className="flex items-center gap-3"><span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center font-bold">{teacher.name?.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold truncate">{teacher.name}</p><p className="text-xs text-slate-400">{teacher.className || "Class not assigned"}{teacher.section ? ` · ${teacher.section}` : ""}</p></div><span className="text-xs font-mono text-slate-400">{teacher.userId}</span></div>) : <EmptyState icon="♙" title="No teachers yet" text="Add your first teacher from the Teachers section." />}</div></Panel></div>
  </>;
}

function Step({ number, title, text, done }) { return <div className="flex gap-3"><span className={`w-8 h-8 rounded-xl grid place-items-center text-[10px] font-black shrink-0 ${done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{done ? "✓" : number}</span><div><p className="text-sm font-bold text-slate-800">{title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{text}</p></div></div>; }

function TeacherManagement({ teachers, onRefresh, onFlash }) {
  const [form, setForm] = useState(blankTeacher);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const reset = () => { setForm(blankTeacher); setEditingId(null); };
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { const payload = { ...form, subjects: form.subjects.split(",").map((item) => item.trim()).filter(Boolean) }; if (editingId) await editAdminTeacher(editingId, payload); else await addAdminTeacher(payload); await onRefresh(); onFlash(editingId ? "Teacher updated." : "Teacher account created."); reset(); } catch (err) { window.alert(err.message); } finally { setSaving(false); } };
  const edit = (teacher) => setForm({ userId: teacher.userId, name: teacher.name, className: teacher.className, section: teacher.section, subjects: teacher.subjects.join(", ") });
  const remove = async (teacher) => { if (!window.confirm(`Remove ${teacher.name}'s teacher account?`)) return; try { await removeAdminTeacher(teacher.id); await onRefresh(); onFlash("Teacher removed."); } catch (err) { window.alert(err.message); } };
  return <><PageIntro eyebrow="People" title="Teacher management" description="Create teaching accounts and assign their class. All teachers use the shared password from School settings." action={<StatusPill tone="green">{teachers.length} accounts</StatusPill>} /><div className="grid xl:grid-cols-[.8fr_1.2fr] gap-5"><Panel title={editingId ? "Edit teacher" : "Add a teacher"} description="Teacher IDs are what staff enter on the central login page."><form onSubmit={submit} className="space-y-4"><Field label="Teacher ID" value={form.userId} onChange={(value) => setForm({ ...form, userId: value })} placeholder="e.g. ayesha-khan" required /><Field label="Full name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="e.g. Ayesha Khan" required /><div className="grid grid-cols-2 gap-3"><Field label="Class" value={form.className} onChange={(value) => setForm({ ...form, className: value })} placeholder="e.g. 7th" /><Field label="Section" value={form.section} onChange={(value) => setForm({ ...form, section: value })} placeholder="e.g. A" /></div><Field label="Subjects" value={form.subjects} onChange={(value) => setForm({ ...form, subjects: value })} placeholder="Math, English, Science" /><div className="flex gap-2"><PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create teacher"}</PrimaryButton>{editingId && <SecondaryButton onClick={reset}>Cancel</SecondaryButton>}</div></form></Panel><Panel title="Teaching accounts" description="Edit assignments any time; teachers keep the same login ID."><div className="space-y-2">{teachers.length ? teachers.map((teacher) => <div key={teacher.id} className="rounded-2xl border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3"><span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center font-bold shrink-0">{teacher.name?.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="font-bold text-sm">{teacher.name}</p><p className="font-mono text-[11px] text-slate-400">{teacher.userId}</p><p className="mt-1 text-xs text-slate-500">{teacher.className || "No class"}{teacher.section ? ` · Section ${teacher.section}` : ""}{teacher.subjects?.length ? ` · ${teacher.subjects.join(", ")}` : ""}</p></div><div className="flex gap-2"><SecondaryButton onClick={() => { setEditingId(teacher.id); edit(teacher); }}>Edit</SecondaryButton><button onClick={() => remove(teacher)} className="rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">Remove</button></div></div>) : <EmptyState icon="♙" title="No teacher accounts" text="Use the form to add your first teacher." />}</div></Panel></div></>;
}

function StudentManagement({ students, onRefresh, onFlash }) {
  const [form, setForm] = useState(blankStudent); const [editingId, setEditingId] = useState(null); const [saving, setSaving] = useState(false); const reset = () => { setForm(blankStudent); setEditingId(null); };
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { if (editingId) await editAdminStudent(editingId, form); else await addAdminStudent(form); await onRefresh(); onFlash(editingId ? "Student updated." : "Student account created."); reset(); } catch (err) { window.alert(err.message); } finally { setSaving(false); } };
  const edit = (student) => { setEditingId(student.id); setForm({ userId: student.userId, name: student.name, className: student.className, section: student.section, rollNumber: student.rollNumber, parentName: student.parentName, parentPhone: student.parentPhone }); };
  const remove = async (student) => { if (!window.confirm(`Remove ${student.name}'s student account?`)) return; try { await removeAdminStudent(student.id); await onRefresh(); onFlash("Student removed."); } catch (err) { window.alert(err.message); } };
  return <><PageIntro eyebrow="People" title="Student management" description="Create simple student IDs. Students share the student password configured in School settings." action={<StatusPill tone="orange">{students.length} accounts</StatusPill>} /><div className="grid xl:grid-cols-[.8fr_1.2fr] gap-5"><Panel title={editingId ? "Edit student" : "Add a student"} description="Use a unique ID students can remember or distribute in a class list."><form onSubmit={submit} className="space-y-4"><div className="grid grid-cols-2 gap-3"><Field className="col-span-2" label="Student ID" value={form.userId} onChange={(value) => setForm({ ...form, userId: value })} placeholder="e.g. ali-7a-01" required /><Field className="col-span-2" label="Full name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="e.g. Ali Hassan" required /><Field label="Class" value={form.className} onChange={(value) => setForm({ ...form, className: value })} placeholder="e.g. 7th" /><Field label="Section" value={form.section} onChange={(value) => setForm({ ...form, section: value })} placeholder="e.g. A" /><Field label="Roll number" value={form.rollNumber} onChange={(value) => setForm({ ...form, rollNumber: value })} placeholder="e.g. 01" /><Field label="Parent phone" value={form.parentPhone} onChange={(value) => setForm({ ...form, parentPhone: value })} placeholder="Optional" /></div><Field label="Parent / guardian name" value={form.parentName} onChange={(value) => setForm({ ...form, parentName: value })} placeholder="Optional" /><div className="flex gap-2"><PrimaryButton type="submit" tone="orange" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create student"}</PrimaryButton>{editingId && <SecondaryButton onClick={reset}>Cancel</SecondaryButton>}</div></form></Panel><Panel title="Student directory" description="Students see only content assigned to their class and section."><div className="space-y-2">{students.length ? students.map((student) => <div key={student.id} className="rounded-2xl border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3"><span className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 grid place-items-center font-bold shrink-0">{student.rollNumber || "•"}</span><div className="min-w-0 flex-1"><p className="font-bold text-sm">{student.name}</p><p className="font-mono text-[11px] text-slate-400">{student.userId}</p><p className="mt-1 text-xs text-slate-500">{student.className || "No class"}{student.section ? ` · Section ${student.section}` : ""}{student.parentName ? ` · ${student.parentName}` : ""}</p></div><div className="flex gap-2"><SecondaryButton onClick={() => edit(student)}>Edit</SecondaryButton><button onClick={() => remove(student)} className="rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">Remove</button></div></div>) : <EmptyState icon="♧" title="No student accounts" text="Use the form to add your first student." />}</div></Panel></div></>;
}

function SettingsPanel({ school, settings, setSettings, onSaved }) {
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const updateColor = (key, value) => setSettings((current) => ({ ...current, colors: { ...current.colors, [key]: value } }));
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { const result = await saveAdminSettings(settings); onSaved(result); } catch (err) { window.alert(err.message); } finally { setSaving(false); } };
  return <><PageIntro eyebrow="Configuration" title="School settings" description="Manage the school profile and the simple shared credentials used by teachers and students." /><form onSubmit={submit} className="grid xl:grid-cols-[1fr_.8fr] gap-5"><Panel title="School profile" description="These details appear throughout the school experience."><div className="space-y-4"><Field label="School name" value={settings.name} onChange={(value) => update("name", value)} required /><Field label="Address" value={settings.address} onChange={(value) => update("address", value)} /><Field label="Phone" value={settings.phone} onChange={(value) => update("phone", value)} /><div className="border-t border-slate-100 pt-4"><p className="text-sm font-bold">Diary theme</p><p className="mt-1 text-xs text-slate-500">Keep the original diary generator's school colors.</p><div className="mt-3 grid grid-cols-2 gap-3">{Object.entries(settings.colors || DEFAULT_COLORS).map(([key, value]) => <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2"><input type="color" value={value} onChange={(event) => updateColor(key, event.target.value)} className="w-8 h-8 rounded cursor-pointer" /><span className="text-xs font-semibold capitalize text-slate-600">{key}</span></label>)}</div></div></div></Panel><Panel title="Unified passwords" description="Change one password for all teachers or all students. IDs still identify each person separately."><div className="space-y-4"><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-800">Teacher password</p><p className="mt-1 text-xs leading-5 text-emerald-700">Leave blank to keep the current password.</p><input type="password" value={settings.teacherPassword} onChange={(event) => update("teacherPassword", event.target.value)} placeholder="Set a new teacher password" className="mt-3 w-full rounded-xl border border-emerald-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" /></div><div className="rounded-2xl bg-orange-50 p-4"><p className="text-sm font-bold text-orange-800">Student password</p><p className="mt-1 text-xs leading-5 text-orange-700">Share this with students through your normal school channel.</p><input type="password" value={settings.studentPassword} onChange={(event) => update("studentPassword", event.target.value)} placeholder="Set a new student password" className="mt-3 w-full rounded-xl border border-orange-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-200" /></div><PrimaryButton type="submit" disabled={saving}>{saving ? "Saving settings…" : "Save all settings"}</PrimaryButton><p className="text-[11px] text-slate-400">Passwords are stored as salted hashes on the server.</p></div></Panel></form></>;
}
