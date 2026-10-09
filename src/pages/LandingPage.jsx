import React from "react";
import { Link } from "react-router-dom";

const features = [
  { icon: "✓", title: "One secure login", text: "Admins, teachers and students enter through one simple portal and are routed to the right workspace." },
  { icon: "▦", title: "Built for daily school life", text: "Attendance, marks, homework, study material and the existing diary and test generators live together." },
  { icon: "◌", title: "Ready on every screen", text: "A calm, responsive interface that works from a phone in class to a desktop in the school office." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      <header className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3" aria-label="SchoolFlow home">
          <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-600 text-slate-950 grid place-items-center font-black shadow-lg shadow-cyan-500/20">S</span>
          <span className="font-bold tracking-tight text-lg">SchoolFlow</span>
        </Link>
        <nav className="flex items-center gap-3">
          <a href="#about" className="hidden sm:inline text-sm text-slate-300 hover:text-white transition">About</a>
          <Link to="/login" className="rounded-full bg-white text-slate-950 px-4 py-2 text-sm font-semibold hover:bg-cyan-100 transition">Sign in</Link>
        </nav>
      </header>

      <main>
        <section className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-12 pb-20 lg:pt-24 lg:pb-28">
          <div className="absolute -top-24 -right-32 w-96 h-96 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative grid lg:grid-cols-[1.08fr_.92fr] gap-12 lg:gap-20 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" /> A calmer way to run your school
              </span>
              <h1 className="mt-6 text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.02]">
                The school day, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">in one place.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base sm:text-lg leading-8 text-slate-300">
                SchoolFlow connects school teams, teachers and students with the tools they use every day — without making anyone hunt through a maze of screens.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/login" className="inline-flex justify-center items-center rounded-xl bg-cyan-300 text-slate-950 px-6 py-3.5 font-bold hover:bg-cyan-200 transition shadow-xl shadow-cyan-500/20">Go to login <span className="ml-2">→</span></Link>
                <a href="#about" className="inline-flex justify-center items-center rounded-xl border border-white/15 px-6 py-3.5 font-semibold text-slate-200 hover:bg-white/5 transition">See how it works</a>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <RolePill color="blue" label="Admin" />
                <RolePill color="green" label="Teacher" />
                <RolePill color="orange" label="Student" />
                <span className="ml-1">One entry point, role-aware dashboards</span>
              </div>
            </div>

            <div className="relative max-w-md lg:ml-auto w-full">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-300/20 to-blue-600/20 blur-2xl rounded-[2rem]" />
              <div className="relative rounded-[2rem] border border-white/15 bg-white/[.08] p-3 shadow-2xl backdrop-blur-xl rotate-1">
                <div className="rounded-[1.5rem] bg-slate-100 overflow-hidden text-slate-800">
                  <div className="bg-white p-4 flex items-center justify-between border-b border-slate-200">
                    <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center font-bold">A</span><div><p className="text-xs font-bold">Good morning, Ayesha</p><p className="text-[10px] text-slate-400">Teacher workspace</p></div></div><span className="text-slate-400">•••</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white p-4"><p className="text-[10px] text-emerald-100 uppercase tracking-widest">Today</p><p className="mt-1 text-xl font-bold">Your class is ready.</p><p className="mt-2 text-[11px] text-emerald-50">24 students · 3 tasks to review</p></div>
                    <div className="grid grid-cols-2 gap-3"><MiniStat value="92%" label="Attendance" /><MiniStat value="08" label="Pending marks" /></div>
                    <div className="bg-white rounded-2xl p-4 border border-slate-200"><div className="flex justify-between items-center"><p className="text-xs font-bold">Quick actions</p><span className="text-[10px] text-emerald-600 font-semibold">View all</span></div><div className="grid grid-cols-3 gap-2 mt-3"><Quick icon="✓" label="Attendance" /><Quick icon="⌁" label="Homework" /><Quick icon="▤" label="Grades" /></div></div>
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex absolute -left-10 bottom-8 items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 shadow-xl backdrop-blur"><span className="w-9 h-9 rounded-xl bg-orange-400/20 text-orange-300 grid place-items-center">★</span><div><p className="text-xs font-bold">Student friendly</p><p className="text-[10px] text-slate-400">Homework, tests & results</p></div></div>
            </div>
          </div>
        </section>

        <section id="about" className="bg-white text-slate-900 py-20 sm:py-24">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[.2em] text-blue-600">Everything connected</p><h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">A shared rhythm for your whole school.</h2><p className="mt-4 text-slate-500 leading-7">Keep the tools you already use, add the workflows you need next, and give every role a focused home screen.</p></div>
            <div className="mt-10 grid md:grid-cols-3 gap-5">{features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}</div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 border-t border-white/10 max-w-none px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <span>© {new Date().getFullYear()} SchoolFlow</span>
        <Link to="/dev" className="opacity-60 hover:opacity-100 transition">System setup</Link>
      </footer>
    </div>
  );
}

function RolePill({ color, label }) {
  const classes = { blue: "bg-blue-400/10 text-blue-200 border-blue-300/20", green: "bg-emerald-400/10 text-emerald-200 border-emerald-300/20", orange: "bg-orange-400/10 text-orange-200 border-orange-300/20" };
  return <span className={`rounded-full border px-2.5 py-1 ${classes[color]}`}>{label}</span>;
}
function FeatureCard({ icon, title, text }) { return <article className="rounded-3xl border border-slate-200 p-6 hover:-translate-y-1 hover:shadow-xl transition"><div className="w-11 h-11 rounded-2xl bg-slate-900 text-cyan-300 grid place-items-center text-xl font-bold">{icon}</div><h3 className="mt-5 font-bold text-lg">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></article>; }
function MiniStat({ value, label }) { return <div className="rounded-2xl bg-white border border-slate-200 p-3"><p className="text-lg font-black">{value}</p><p className="text-[10px] text-slate-400 mt-1">{label}</p></div>; }
function Quick({ icon, label }) { return <div className="rounded-xl bg-slate-50 p-2 text-center"><span className="text-emerald-600 font-bold">{icon}</span><p className="mt-1 text-[9px] text-slate-500">{label}</p></div>; }
