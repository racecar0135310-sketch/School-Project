import React from "react";

export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Application rendering failed:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <main className="min-h-screen bg-slate-50 px-5 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm" role="alert">
        <p className="text-xs font-black uppercase tracking-[.2em] text-red-600">Unexpected error</p>
        <h1 className="mt-3 text-2xl font-black text-slate-900">This page hit a problem.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Your saved school data is unchanged. Try reloading the page or return to the home screen.</p>
        <div className="mt-6 flex justify-center gap-3"><button onClick={() => window.location.reload()} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">Reload page</button><a href="/" className="min-h-11 rounded-xl border border-slate-200 px-4 inline-flex items-center text-sm font-bold text-slate-700">Go home</a></div>
      </section>
    </main>;
  }
}
