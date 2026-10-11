import React, { useEffect, useState } from "react";
import { adminApi, createTeacherExam, getTeacherAssignments, getTeacherSchedule, gradeTeacherSubmission, submitStudentAssignment, teacherCheckIn, teacherCheckOut } from "../lib/storage.js";
import { EmptyState, Field, LoadingState, Notice, PageIntro, Panel, PrimaryButton, SecondaryButton, StatusPill } from "./LmsUi.jsx";
import { useDialog, useToast } from "./UIProvider.jsx";

const today = () => new Date().toISOString().slice(0, 10);
const field = (label, value, onChange, placeholder = "", type = "text", extra = {}) => <Field label={label} value={value} onChange={onChange} placeholder={placeholder} type={type} {...extra} />;

export function AdminModules({ view, teachers = [], students = [] }) {
  const config = {
    classes: { title: "Classes & subjects", endpoint: "classes", fields: ["className", "section", "subjects", "teacherIds", "academicYear"] },
    timetable: { title: "Timetable", endpoint: "timetable", fields: ["className", "section", "subject", "teacherId", "weekday", "startTime", "endTime", "room"] },
    calendar: { title: "Academic calendar", endpoint: "calendar", fields: ["title", "kind", "startDate", "endDate", "description"] },
    exams: { title: "Examinations", endpoint: "exams", fields: ["title", "type", "className", "section", "subject", "date", "startTime", "endTime", "room", "maxMarks", "instructions"] },
    fees: { title: "Fees & payments", endpoint: "fees", fields: ["studentId", "head", "amount", "discount", "dueDate", "notes"] },
    audit: { title: "Activity log", endpoint: "audit?limit=250", fields: [] },
  };
  if (view === "attendance") return <AdminAttendance />;
  if (view === "staff-attendance") return <AdminTeacherAttendance />;
  if (view === "reports") return <ReportsModule />;
  if (view === "import") return <ImportStudents />;
  const selected = config[view];
  if (!selected) return null;
  return <AdminDataModule key={view} view={view} config={selected} teachers={teachers} students={students} />;
}

function AdminDataModule({ view, config, teachers, students }) {
  const { confirm, prompt } = useDialog();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const initial = Object.fromEntries(config.fields.map((key) => [key, key === "teacherIds" ? [] : key === "date" || key === "startDate" || key === "dueDate" ? today() : key === "endDate" ? today() : key === "weekday" ? "1" : key === "maxMarks" ? "100" : key === "amount" ? "" : key === "discount" ? "0" : key === "kind" ? "event" : key === "type" ? "unit" : ""]));
  const [form, setForm] = useState(initial);
  const load = async () => { setLoading(true); try { setRows(await adminApi(config.endpoint)); setError(""); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [view]);
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const create = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    const payload = { ...form };
    if (payload.subjects !== undefined) payload.subjects = payload.subjects.split(",").map((value) => value.trim()).filter(Boolean);
    if (payload.weekday !== undefined) payload.weekday = Number(payload.weekday);
    if (payload.maxMarks !== undefined) payload.maxMarks = Number(payload.maxMarks);
    if (payload.amount !== undefined) payload.amount = Number(payload.amount);
    if (payload.discount !== undefined) payload.discount = Number(payload.discount || 0);
    try { await adminApi(config.endpoint, "POST", payload); setForm(initial); setNotice("Saved successfully."); toast("Saved successfully.", "success"); await load(); } catch (err) { setError(err.message); toast(err.message, "error"); } finally { setBusy(false); }
  };
  const remove = async (row) => { const title = row.title || row.className || row.subject || row.invoiceNumber || "this record"; if (!await confirm({ title: "Delete record?", message: `Remove ${title}? This action cannot be undone.`, danger: true, confirmText: "Delete" })) return; try { await adminApi(`${config.endpoint.split("?")[0]}/${row.id}`, "DELETE"); await load(); toast("Record deleted.", "success"); } catch (err) { setError(err.message); toast(err.message, "error"); } };
  const recordPayment = async (row) => { const raw = await prompt({ title: "Record fee payment", message: `Outstanding balance: ${row.balance} ${row.currency}. Enter the payment amount.`, inputLabel: "Payment amount", inputType: "number", placeholder: "Amount" }); if (raw === null) return; const amount = Number(raw); if (!Number.isFinite(amount) || amount <= 0) return toast("Enter a valid positive payment amount.", "error"); try { await adminApi(`fees/${row.id}/payments`, "POST", { amount, method: "cash", paidAt: today() }); await load(); toast("Payment recorded.", "success"); } catch (err) { setError(err.message); toast(err.message, "error"); } };
  const toggleActive = async (row) => { try { await adminApi(`classes/${row.id}`, "PUT", { ...row, active: !row.active }); await load(); toast("Attendance corrected.", "success"); } catch (err) { setError(err.message); toast(err.message, "error"); } };
  const editRecord = async (row) => {
    const ask = (label, value) => prompt({ title: `Edit ${label.toLowerCase()}`, message: "Enter the updated value.", defaultValue: value ?? "", inputLabel: label });
    let payload;
    if (view === "classes") {
      const className = await ask("Class name", row.className); if (className === null) return;
      const section = await ask("Section", row.section); if (section === null) return;
      const subjects = await ask("Subjects (comma-separated)", (row.subjects || []).join(", ")); if (subjects === null) return;
      payload = { ...row, className, section, subjects: subjects.split(",").map((value)=>value.trim()).filter(Boolean) };
    } else if (view === "calendar") {
      const title = await ask("Event title", row.title); if (title === null) return;
      const startDate = await ask("Start date (YYYY-MM-DD)", row.startDate); if (startDate === null) return;
      payload = { ...row, title, startDate };
    } else if (view === "exams") {
      const title = await ask("Exam title", row.title); if (title === null) return;
      const date = await ask("Exam date (YYYY-MM-DD)", row.date); if (date === null) return;
      const status = await ask("Status (scheduled, completed, cancelled)", row.status); if (status === null) return;
      payload = { ...row, title, date, status };
    } else if (view === "timetable") {
      const startTime = await ask("Start time (HH:MM)", row.startTime); if (startTime === null) return;
      const endTime = await ask("End time (HH:MM)", row.endTime); if (endTime === null) return;
      payload = { ...row, teacherId: row.teacherId?._id || row.teacherId || "", startTime, endTime };
    } else return;
    try { await adminApi(`${config.endpoint}/${row.id}`, "PUT", payload); await load(); toast("Changes saved.", "success"); } catch (err) { setError(err.message); toast(err.message, "error"); }
  };
  return <><PageIntro eyebrow="School operations" title={config.title} description={descriptions[view]} action={<StatusPill tone="blue">{rows.length} records</StatusPill>} />
    {error && <div className="mb-4"><Notice>{error}</Notice></div>}{notice && <div className="mb-4"><Notice type="success">{notice}</Notice></div>}
    {config.fields.length > 0 && <Panel title={`Add ${view === "classes" ? "class" : view === "timetable" ? "period" : view === "calendar" ? "event" : view === "exams" ? "exam" : "invoice"}`} description="Records are restricted to this school's account."><form onSubmit={create} className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {config.fields.map((key) => <label key={key} className="block"><span className="text-xs font-semibold capitalize text-slate-500">{labels[key] || key}</span>{key === "teacherId" || key === "studentId" ? <select required value={form[key]} onChange={(e) => update(key, e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Select {key === "teacherId" ? "teacher" : "student"}</option>{(key === "teacherId" ? teachers : students).map((item) => <option key={item.id} value={item.id}>{item.name}{item.className ? ` · ${item.className}` : ""}{item.rollNumber ? ` · ${item.rollNumber}` : ""}</option>)}</select> : key === "teacherIds" ? <select multiple value={form.teacherIds} onChange={(e) => update(key, [...e.target.selectedOptions].map((option) => option.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">{teachers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.userId}</option>)}</select> : key === "weekday" || key === "kind" || key === "type" ? <select value={form[key]} onChange={(e) => update(key, e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">{(key === "weekday" ? [[0,"Sunday"],[1,"Monday"],[2,"Tuesday"],[3,"Wednesday"],[4,"Thursday"],[5,"Friday"],[6,"Saturday"]] : key === "kind" ? [["academic","Academic"],["exam","Exam"],["holiday","Holiday"],["event","Event"]] : [["unit","Unit test"],["midterm","Midterm"],["final","Final"],["practical","Practical"],["viva","Viva"],["other","Other"]]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select> : <input required={["className","subject","title","date","startDate","startTime","endTime","amount","dueDate"].includes(key)} type={key.includes("Date") || key === "date" || key === "dueDate" ? "date" : key.endsWith("Time") ? "time" : ["amount","discount","maxMarks"].includes(key) ? "number" : "text"} min={["amount","discount","maxMarks"].includes(key) ? "0" : undefined} value={form[key]} placeholder={key === "subjects" ? "Math, English, Science" : labels[key] || key} onChange={(e) => update(key, e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" />}</label>)}
      <div className="sm:col-span-2 xl:col-span-3"><PrimaryButton type="submit" disabled={busy}>{busy ? "Saving…" : `Add ${view === "classes" ? "class" : view === "timetable" ? "period" : view === "calendar" ? "event" : view === "exams" ? "exam" : "invoice"}`}</PrimaryButton></div>
    </form></Panel>}
    <Panel title={view === "audit" ? "Recent school activity" : `Saved ${view}`} description={view === "fees" ? "Record partial payments until an invoice is settled." : undefined}>{loading ? <LoadingState /> : rows.length ? <div className="space-y-2">{rows.map((row) => <AdminRecord key={row.id} view={view} row={row} onRemove={() => remove(row)} onPay={() => recordPayment(row)} onToggle={() => toggleActive(row)} onEdit={() => editRecord(row)} />)}</div> : <EmptyState title={`No ${view} yet`} text="Use the form above to create the first record." />}</Panel>
  </>;
}

function AdminRecord({ view, row, onRemove, onPay, onToggle, onEdit }) {
  const title = row.title || row.className || row.subject || row.head || row.action || "Record";
  const detail = view === "fees" ? `${row.studentId?.name || "Student"} · ${row.amount} ${row.currency} · Paid ${row.paid} · Balance ${row.balance} · Due ${row.dueDate}` : view === "timetable" ? `${weekday(row.weekday)} · ${row.startTime}–${row.endTime} · ${row.className}${row.section ? ` ${row.section}` : ""} · ${row.teacherName || "No teacher"}${row.room ? ` · Room ${row.room}` : ""}` : view === "calendar" ? `${row.kind} · ${row.startDate}${row.endDate && row.endDate !== row.startDate ? ` to ${row.endDate}` : ""} · ${row.description || ""}` : view === "exams" ? `${row.type} · ${row.className}${row.section ? ` ${row.section}` : ""} · ${row.subject} · ${row.date} · ${row.maxMarks} marks` : view === "classes" ? `${row.section || "No section"} · ${(row.subjects || []).join(", ") || "No subjects"} · ${row.academicYear || ""}` : `${row.role || ""} · ${row.entity || ""} · ${new Date(row.createdAt).toLocaleString()} · ${row.actorName || row.actorId || "System"}`;
  return <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-100 p-3"><div className="min-w-0 flex-1"><p className="text-sm font-bold">{title}{view === "fees" && <StatusPill tone={row.status === "paid" ? "green" : row.status === "partial" ? "orange" : "red"}>{row.status}</StatusPill>}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><div className="flex gap-2">{view === "fees" && row.balance > 0 && <SecondaryButton onClick={onPay}>Record payment</SecondaryButton>}{view === "classes" && <><SecondaryButton onClick={onEdit}>Edit</SecondaryButton><SecondaryButton onClick={onToggle}>{row.active ? "Deactivate" : "Activate"}</SecondaryButton></>}{["calendar","timetable","exams"].includes(view) && <><SecondaryButton onClick={onEdit}>Edit</SecondaryButton><button onClick={onRemove} className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">Delete</button></>}</div></div>;
}

function ReportsModule() {
  const [report, setReport] = useState(null); const [error, setError] = useState("");
  useEffect(() => { adminApi("reports/summary").then(setReport).catch((err) => setError(err.message)); }, []);
  const csv = () => { const rows = Object.entries(report || {}); const text = ["metric,value", ...rows.map(([key,value]) => `${key},${JSON.stringify(value ?? "")}`)].join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); link.download = "school-summary.csv"; link.click(); URL.revokeObjectURL(link.href); };
  return <><PageIntro eyebrow="Analytics" title="Reports & analytics" description="Current enrollment, attendance, grade, and fee collection summary." action={report && <SecondaryButton onClick={csv}>Export CSV</SecondaryButton>} />{error && <Notice>{error}</Notice>}{!report ? <LoadingState /> : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{Object.entries(report).map(([key,value]) => <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold capitalize text-slate-500">{key.replace(/([A-Z])/g," $1")}</p><p className="mt-2 text-2xl font-black text-slate-900">{value === null ? "—" : value}</p></div>)}</div>}</>;
}

function ImportStudents() {
  const toast = useToast();
  const [csv, setCsv] = useState("userId,name,className,section,rollNumber,parentName,parentPhone,email\n"); const [result, setResult] = useState(null); const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  const importRows = async (event) => { event.preventDefault(); setBusy(true); setError(""); try { setResult(await adminApi("import/students","POST",{csv})); toast("Student import finished.", "success"); } catch(err) { setError(err.message); toast(err.message, "error"); } finally { setBusy(false); } };
  return <><PageIntro eyebrow="User management" title="Import students" description="Paste CSV text with a header row. Required columns: userId and name. Other supported columns: className, section, rollNumber, parentName, parentPhone, email, phone." /><Panel title="CSV import" description="Existing or invalid IDs are skipped and reported; imports never overwrite existing student records."><form onSubmit={importRows} className="space-y-4"><textarea value={csv} onChange={(event) => setCsv(event.target.value)} rows={12} className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs" /><PrimaryButton type="submit" disabled={busy}>{busy ? "Importing…" : "Import students"}</PrimaryButton></form>{error && <div className="mt-4"><Notice>{error}</Notice></div>}{result && <div className="mt-4"><p className="text-sm font-bold text-emerald-700">Imported {result.created}; skipped {result.skipped.length}.</p>{result.skipped.map((item,index) => <p key={index} className="text-xs text-slate-500">{item.userId || "(empty ID)"}: {item.reason}</p>)}</div>}</Panel></>;
}

function AdminAttendance() {
  const toast = useToast();
  const [date,setDate] = useState(today()); const [rows,setRows] = useState([]); const [error,setError] = useState("");
  const load = () => adminApi(`attendance?date=${date}`).then(setRows).catch((err)=>setError(err.message));
  useEffect(()=>{load();},[date]);
  const update = async (attendanceId, studentId, status) => { try { await adminApi(`attendance/${attendanceId}`, "PATCH", { studentId, status }); await load(); toast("Attendance corrected.", "success"); } catch (err) { setError(err.message); toast(err.message, "error"); } };
  return <><PageIntro eyebrow="School operations" title="Attendance review" description="Review or correct daily attendance submitted by teachers." action={<input aria-label="Attendance date" type="date" value={date} onChange={(event)=>setDate(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" />} />{error && <div className="mb-4"><Notice>{error}</Notice></div>}{rows.length ? <div className="space-y-4">{rows.map((row)=><Panel key={row.id} title={`${row.className}${row.section ? ` · ${row.section}` : ""}`} description={`${row.teacherName || "Teacher"} · ${row.date}`}><div className="space-y-2">{row.records.map((record)=><div key={record.studentId} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-slate-100 p-3"><p className="flex-1 text-sm font-bold">{record.student?.name || "Student"} <span className="text-xs font-normal text-slate-400">{record.student?.rollNumber || ""}</span></p><select value={record.status} onChange={(event)=>update(row.id,record.studentId,event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs capitalize">{["present","late","absent","half-day","leave"].map((status)=><option key={status} value={status}>{status}</option>)}</select></div>)}</div></Panel>)}</div> : <Panel title="Daily register"><EmptyState title="No attendance records" text="No teacher register has been saved for this date." /></Panel>}</>;
}

function AdminTeacherAttendance() {
  const [date,setDate] = useState(today()); const [rows,setRows] = useState([]); const [error,setError] = useState("");
  useEffect(()=>{adminApi(`teacher-attendance?date=${date}`).then(setRows).catch((err)=>setError(err.message));},[date]);
  return <><PageIntro eyebrow="School operations" title="Teacher attendance" description="Review staff check-in and check-out records." action={<input aria-label="Attendance date" type="date" value={date} onChange={(event)=>setDate(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" />} />{error && <Notice>{error}</Notice>}<Panel title="Staff register">{rows.length ? <div className="space-y-2">{rows.map((row)=><div key={row.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><div className="min-w-0 flex-1"><p className="text-sm font-bold">{row.teacher?.name || "Teacher"}</p><p className="text-xs text-slate-500">{row.teacher?.userId || ""} · {row.status}</p></div><p className="text-xs text-slate-500">In {row.checkIn ? new Date(row.checkIn).toLocaleTimeString() : "—"} · Out {row.checkOut ? new Date(row.checkOut).toLocaleTimeString() : "—"}</p></div>)}</div> : <EmptyState title="No staff records" text="No teacher check-ins found for this date." />}</Panel></>;
}

export function TeacherExtras({ view }) {
  const [data,setData] = useState(null); const [error,setError] = useState(""); const [busy,setBusy] = useState(false); const [marks,setMarks] = useState({});
  const [exam,setExam] = useState({ title:"", type:"unit", subject:"", date:today(), startTime:"", endTime:"", room:"", maxMarks:"100", instructions:"" });
  const checkIn = async () => { try { const item = await teacherCheckIn(); setData((old) => ({ ...old, teacherAttendance: [item, ...(old.teacherAttendance || []).filter((record) => record.id !== item.id)] })); } catch (err) { setError(err.message); } };
  const checkOut = async () => { try { const item = await teacherCheckOut(); setData((old) => ({ ...old, teacherAttendance: old.teacherAttendance.map((record) => record.id === item.id ? item : record) })); } catch (err) { setError(err.message); } };
  useEffect(() => { (view === "schedule" ? getTeacherSchedule() : getTeacherAssignments()).then(setData).catch((err) => setError(err.message)); }, [view]);
  if (error) return <Notice>{error}</Notice>; if (!data) return <LoadingState />;
  if (view === "schedule") return <><PageIntro eyebrow="Teaching" title="Schedule & exams" description="Your assigned teaching timetable, upcoming exam dates and school calendar." action={<div className="flex gap-2"><SecondaryButton onClick={checkIn}>Check in</SecondaryButton><SecondaryButton onClick={checkOut}>Check out</SecondaryButton></div>} /><div className="grid xl:grid-cols-3 gap-4"><RecordPanel title="My timetable" rows={data.timetable} line={(item) => `${weekday(item.weekday)} · ${item.startTime}-${item.endTime} · ${item.subject} · ${item.className} ${item.section}`} /><RecordPanel title="Upcoming exams" rows={data.exams} line={(item) => `${item.date} · ${item.subject} · ${item.title}`} /><RecordPanel title="Calendar" rows={data.calendar} line={(item) => `${item.startDate} · ${item.kind} · ${item.title}`} /></div><Panel title="My attendance" description="Daily check-in and check-out records."><div className="space-y-2">{(data.teacherAttendance||[]).length ? data.teacherAttendance.map((item)=><div key={item.id} className="rounded-xl bg-slate-50 p-3 text-xs">{item.date} · In: {item.checkIn ? new Date(item.checkIn).toLocaleTimeString() : "—"} · Out: {item.checkOut ? new Date(item.checkOut).toLocaleTimeString() : "—"}</div>) : <EmptyState title="No check-ins yet" text="Use Check in when you arrive at school." />}</div></Panel><Panel title="Schedule an exam" description="Exams are automatically limited to your assigned class and section."><form onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(""); try { const saved = await createTeacherExam({ ...exam, maxMarks:Number(exam.maxMarks) }); setData((old) => ({ ...old, exams:[...old.exams,saved].sort((a,b)=>a.date.localeCompare(b.date)) })); setExam({ title:"", type:"unit", subject:"", date:today(), startTime:"", endTime:"", room:"", maxMarks:"100", instructions:"" }); } catch(err) { setError(err.message); } finally { setBusy(false); } }} className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{[["title","Exam title","text"],["type","Type","text"],["subject","Subject","text"],["date","Date","date"],["startTime","Start time","time"],["endTime","End time","time"],["room","Room","text"],["maxMarks","Maximum marks","number"]].map(([key,label,type])=><Field key={key} label={label} type={type} min={type === "number" ? "1" : undefined} value={exam[key]} onChange={(value)=>setExam((old)=>({...old,[key]:value}))} required={! ["startTime","endTime","room"].includes(key)} />)}<div className="sm:col-span-2 xl:col-span-3"><PrimaryButton type="submit" disabled={busy}>{busy ? "Saving…" : "Schedule exam"}</PrimaryButton></div></form></Panel></>;
  const grade = async (item) => { const value = marks[item.id] || {}; setBusy(true); try { await gradeTeacherSubmission(item.id, { marks: Number(value.marks), feedback: value.feedback || "" }); setData(await getTeacherAssignments()); } catch(err) { setError(err.message); } finally { setBusy(false); } };
  return <><PageIntro eyebrow="Teaching" title="Assignment submissions" description="Review learner submissions and provide marks and feedback." /><Panel title="Submitted work" description="Assignments and submissions from your assigned class.">{data.submissions.length ? <div className="space-y-3">{data.submissions.map((item) => <div key={item.id} className="rounded-2xl border border-slate-100 p-4"><p className="font-bold text-sm">{item.student?.name || "Student"} · {item.homeworkId?.title || "Assignment"}</p><p className="mt-1 text-xs text-slate-500">{item.submissionText || "File attached"}</p>{item.attachmentData && <a className="mt-2 inline-block text-xs font-bold text-blue-700" download={item.attachmentName || "submission"} href={item.attachmentData}>Download {item.attachmentName || "file"}</a>}<div className="mt-3 grid sm:grid-cols-[120px_1fr_auto] gap-2"><input type="number" min="0" value={marks[item.id]?.marks ?? item.marks ?? ""} onChange={(e) => setMarks((old) => ({...old,[item.id]:{...old[item.id],marks:e.target.value}}))} placeholder="Marks" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><input value={marks[item.id]?.feedback ?? item.feedback ?? ""} onChange={(e) => setMarks((old) => ({...old,[item.id]:{...old[item.id],feedback:e.target.value}}))} placeholder="Feedback" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><PrimaryButton disabled={busy} onClick={() => grade(item)}>Save grade</PrimaryButton></div></div>)}</div> : <EmptyState title="No submissions yet" text="Learner work will show here when submitted." />}</Panel></>;
}

export function StudentExtras({ view, data }) {
  const [texts,setTexts] = useState({}); const [busy,setBusy] = useState(""); const [error,setError] = useState("");
  if (view === "attendance") {
    const registers = (data.attendance || []).flatMap((day) => day.records.map((record) => ({ date: day.date, status: record.status, id: `${day.id}-${record.studentId}` }))).sort((a,b) => b.date.localeCompare(a.date));
    const counted = registers.length;
    const present = registers.filter((item) => ["present", "late", "half-day"].includes(item.status)).length;
    return <><PageIntro eyebrow="My school" title="Attendance history" description="Your recorded daily attendance and overall attendance rate." action={<StatusPill tone="orange">{counted ? `${Math.round(present * 100 / counted)}%` : "No records"}</StatusPill>} /><RecordPanel title="Daily attendance" rows={registers} line={(item) => `${item.date} · ${item.status}`} /></>;
  }
  if (view === "timetable") return <><PageIntro eyebrow="My school" title="Timetable & calendar" description="Your class schedule, upcoming exams and school dates." /><div className="grid xl:grid-cols-3 gap-4"><RecordPanel title="Weekly timetable" rows={data.timetable || []} line={(item) => `${weekday(item.weekday)} · ${item.startTime}-${item.endTime} · ${item.subject} · ${item.teacherName || "Teacher TBD"}${item.room ? ` · ${item.room}` : ""}`} /><RecordPanel title="Upcoming exams" rows={data.exams || []} line={(item) => `${item.date} · ${item.title} · ${item.subject} · ${item.maxMarks} marks`} /><RecordPanel title="Calendar" rows={data.calendar || []} line={(item) => `${item.startDate} · ${item.kind} · ${item.title}`} /></div></>;
  return <><PageIntro eyebrow="My account" title="Fee invoices" description="Review invoices, due dates, payments and current balances. Online card payments are not enabled." /><RecordPanel title="My invoices" rows={data.fees || []} line={(item) => `${item.invoiceNumber} · ${item.head} · ${item.amount} ${item.currency} · Paid ${item.paid} · Balance ${item.balance} · Due ${item.dueDate}`} /></>;
}

export function AssignmentSubmission({ item }) {
  const toast = useToast();
  const [text,setText] = useState(item.submission?.submissionText || ""); const [file,setFile] = useState(null); const [status,setStatus] = useState(""); const [error,setError] = useState("");
  const send = async () => { setError(""); setStatus("Submitting…"); try { let attachmentData = ""; let attachmentName = ""; if (file) { if (file.size > 3 * 1024 * 1024) throw new Error("Choose a file smaller than 3 MB."); attachmentData = await readFile(file); attachmentName = file.name; } await submitStudentAssignment(item.id, { submissionText: text, attachmentData, attachmentName }); setStatus("Submitted"); toast("Assignment submitted.", "success"); } catch (err) { setStatus(""); setError(err.message); toast(err.message, "error"); } };
  return <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-xs font-semibold text-slate-600">{item.submission ? `Submitted${item.submission.marks !== null ? ` · ${item.submission.marks} marks` : " · Awaiting grade"}` : "Submit your work"}</p>{item.submission?.feedback && <p className="mt-1 text-xs text-emerald-700">Feedback: {item.submission.feedback}</p>}<textarea value={text} onChange={(e)=>setText(e.target.value)} rows={2} placeholder="Write your answer or submission note" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /><div className="mt-2 flex flex-wrap items-center gap-2"><input type="file" onChange={(e)=>setFile(e.target.files?.[0] || null)} className="min-w-0 text-xs" /><PrimaryButton onClick={send}>{status === "Submitting…" ? status : item.submission ? "Update submission" : "Submit assignment"}</PrimaryButton>{status === "Submitted" && <span className="text-xs text-emerald-700">Submitted</span>}</div>{error && <p className="mt-1 text-xs text-red-600">{error}</p>}</div>;
}

function RecordPanel({ title, rows = [], line }) { return <Panel title={title}>{rows.length ? <div className="space-y-2">{rows.map((row) => <div key={row.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-bold">{row.title || row.subject || row.head || row.className || "Record"}</p><p className="mt-1 text-xs text-slate-500">{line(row)}</p></div>)}</div> : <EmptyState title="Nothing scheduled" />}</Panel>; }

function readFile(file) { return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error("Unable to read file.")); reader.readAsDataURL(file); }); }
function weekday(value) { return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][Number(value)] || "Day"; }
const labels = { className:"Class", section:"Section", subjects:"Subjects (comma-separated)", academicYear:"Academic year", teacherId:"Teacher", studentId:"Student", weekday:"Weekday", startTime:"Start time", endTime:"End time", room:"Room", kind:"Category", type:"Exam type", title:"Title", startDate:"Start date", endDate:"End date", date:"Exam date", maxMarks:"Maximum marks", amount:"Amount", discount:"Discount", dueDate:"Due date", head:"Fee head", instructions:"Instructions", description:"Description" };
const descriptions = { classes:"Create classes, sections and subject lists; assign teachers to a section.", timetable:"Set weekly periods and assign teachers, rooms and subjects.", calendar:"Manage academic events, exam days, holidays and school events.", exams:"Schedule unit, midterm, final, practical and viva assessments.", fees:"Create fee invoices, apply discounts and record cash/bank/online payments.", audit:"Important administrative and academic actions recorded by the system." };
