import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(null);
const DialogContext = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);
  const toast = useCallback((message, type = "info") => {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4500);
  }, []);
  const closeDialog = useCallback((value) => {
    resolver.current?.(value);
    resolver.current = null;
    setDialog(null);
  }, []);
  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setDialog({ kind: "confirm", ...options });
  }), []);
  const prompt = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setDialog({ kind: "prompt", ...options });
  }), []);
  useEffect(() => {
    if (!dialog) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") closeDialog(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog, closeDialog]);

  return <ToastContext.Provider value={{ toast }}><DialogContext.Provider value={{ confirm, prompt }}>
    {children}
    <div className="fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-atomic="false">
      {toasts.map((item) => <div key={item.id} role={item.type === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-lg transition-all ${item.type === "error" ? "border-red-200 bg-white text-red-700" : item.type === "success" ? "border-emerald-200 bg-white text-emerald-700" : "border-slate-200 bg-white text-slate-700"}`}>{item.message}</div>)}
    </div>
    {dialog && <DialogView dialog={dialog} onClose={closeDialog} />}
  </DialogContext.Provider></ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside UIProvider.");
  return context.toast;
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("useDialog must be used inside UIProvider.");
  return context;
}

function DialogView({ dialog, onClose }) {
  const [value, setValue] = useState(dialog.defaultValue ?? "");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, [dialog]);
  const submit = (event) => { event.preventDefault(); onClose(dialog.kind === "prompt" ? value : true); };
  return <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(null); }}>
    <form role="dialog" aria-modal="true" aria-labelledby="dialog-title" onSubmit={submit} className="w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
      <h2 id="dialog-title" className="text-lg font-black text-slate-900">{dialog.title || (dialog.kind === "prompt" ? "Enter a value" : "Please confirm")}</h2>
      {dialog.message && <p className="mt-2 text-sm leading-6 text-slate-600">{dialog.message}</p>}
      {dialog.kind === "prompt" && <input ref={inputRef} aria-label={dialog.inputLabel || dialog.title || "Value"} type={dialog.inputType || "text"} value={value} onChange={(event) => setValue(event.target.value)} placeholder={dialog.placeholder} className="mt-4 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />}
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => onClose(null)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">{dialog.cancelText || "Cancel"}</button><button type="submit" className={`min-h-11 rounded-xl px-4 text-sm font-bold text-white ${dialog.danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-700 hover:bg-blue-800"}`}>{dialog.confirmText || (dialog.kind === "prompt" ? "Save" : "Confirm")}</button></div>
    </form>
  </div>;
}
