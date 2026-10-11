import React from "react";

// A production build should never leave a user with a blank white screen.
// This boundary gives a useful recovery action and logs the original error
// for developers, while network/API failures continue to be handled by the
// individual page states.
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("SchoolFlow UI error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.07] p-7 text-center shadow-2xl">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-red-400/15 text-red-200 grid place-items-center text-xl">!</div>
          <h1 className="mt-5 text-xl font-black">This screen could not load</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Refresh the page. If the problem continues, make sure the API server is running and server/.env contains a valid MongoDB connection string.</p>
          <button onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200">Refresh SchoolFlow</button>
          <p className="mt-4 break-words text-[11px] text-slate-500">{this.state.error?.message || "Unexpected application error"}</p>
        </div>
      </div>
    );
  }
}
