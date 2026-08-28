import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getExpenses, addExpense, deleteExpense, updateExpense, getExpenseSummary } from "../api/expenseService";
import { createSettlement, listSettlements, markSettled } from "../api/settlementService";

/* ── helpers ───────────────────────────────────────────────── */
const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const CAT_META = {
  hotel:          { emoji: "🏨", label: "Hotel",          color: "text-indigo-400",  bg: "bg-indigo-500/15",  border: "border-indigo-500/25" },
  food:           { emoji: "🍔", label: "Food",           color: "text-amber-400",   bg: "bg-amber-500/15",   border: "border-amber-500/25"  },
  activities:     { emoji: "🎯", label: "Activities",     color: "text-sky-400",     bg: "bg-sky-500/15",     border: "border-sky-500/25"    },
  transportation: { emoji: "🚗", label: "Transportation", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/25" },
  shopping:       { emoji: "🛍️", label: "Shopping",       color: "text-rose-400",    bg: "bg-rose-500/15",    border: "border-rose-500/25"   },
  other:          { emoji: "📦", label: "Other",           color: "text-gray-400",    bg: "bg-gray-500/15",    border: "border-gray-500/25"   },
};
function catMeta(c) { return CAT_META[c] || CAT_META.other; }

/* ── MiniTab ────────────────────────────────────────────────── */
function MiniTab({ id, label, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
        active ? "bg-sky-500 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

/* ── AddExpenseModal ────────────────────────────────────────── */
function AddExpenseModal({ trip, members, onClose, onSaved, editingExpense }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const defaultPaidBy = members.find(m => m.userId === user?.uid) || members[0] || null;

  const [form, setForm] = useState({
    title:     editingExpense?.title || editingExpense?.description || "",
    category:  editingExpense?.category || "food",
    amount:    editingExpense?.amount || "",
    date:      editingExpense?.date ? editingExpense.date.substring(0, 10) : new Date().toISOString().substring(0, 10),
    notes:     editingExpense?.notes || "",
    paidBy:    editingExpense?.paidBy || { userId: defaultPaidBy?.userId || "", name: defaultPaidBy?.name || "" },
    splitType: editingExpense?.splitType || "equal",
    splits:    editingExpense?.splits || [],
  });

  // Recompute splits whenever amount, splitType, or split members change
  const buildEqualSplits = (amount, mems) =>
    mems.map(m => ({ userId: m.userId, name: m.name, amount: parseFloat((amount / mems.length).toFixed(2)), percentage: parseFloat((100 / mems.length).toFixed(2)) }));

  const [splitMembers, setSplitMembers] = useState(
    editingExpense?.splits?.length > 0
      ? editingExpense.splits.map(s => s.userId)
      : members.map(m => m.userId)
  );

  const toggleSplitMember = (uid) => {
    setSplitMembers(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const selectedMembers = members.filter(m => splitMembers.includes(m.userId));

  // Custom split state per member
  const [customAmounts, setCustomAmounts] = useState({});
  const [customPcts, setCustomPcts]       = useState({});

  const computedSplits = () => {
    const amt = Number(form.amount) || 0;
    if (form.splitType === "equal") return buildEqualSplits(amt, selectedMembers);
    if (form.splitType === "custom") return selectedMembers.map(m => ({ userId: m.userId, name: m.name, amount: Number(customAmounts[m.userId] || 0), percentage: 0 }));
    if (form.splitType === "percentage") return selectedMembers.map(m => {
      const pct = Number(customPcts[m.userId] || 0);
      return { userId: m.userId, name: m.name, amount: parseFloat(((pct / 100) * amt).toFixed(2)), percentage: pct };
    });
    return [];
  };

  const splitTotal = () => computedSplits().reduce((s, x) => s + Number(x.amount || 0), 0);
  const pctTotal   = () => computedSplits().reduce((s, x) => s + Number(x.percentage || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    const splits = computedSplits();
    const payload = {
      tripId: trip._id,
      title: form.title,
      description: form.title,
      category: form.category,
      amount: Number(form.amount),
      date: form.date,
      notes: form.notes,
      paidBy: form.paidBy,
      splitType: form.splitType,
      splits,
    };
    setSaving(true);
    try {
      if (editingExpense) await updateExpense(editingExpense._id, payload);
      else await addExpense(payload);
      onSaved();
      onClose();
    } catch (e) { setErr(e.message || "Failed to save expense"); }
    finally { setSaving(false); }
  };

  const amt = Number(form.amount) || 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[600] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="font-bold text-white">{editingExpense ? "✏️ Edit Expense" : "➕ Add Expense"}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center text-sm transition">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">{err}</div>}

          {/* Title + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Title</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Dinner at Beach" className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition">
                {Object.entries(CAT_META).map(([v, m]) => <option key={v} value={v}>{m.emoji} {m.label}</option>)}
              </select>
            </div>
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Amount (INR)</label>
              <input required type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="1500" className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition" />
            </div>
          </div>

          {/* Paid By */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">💳 Paid By</label>
            <select
              value={form.paidBy?.userId || ""}
              onChange={e => {
                const m = members.find(x => x.userId === e.target.value);
                if (m) setForm(f => ({ ...f, paidBy: { userId: m.userId, name: m.name } }));
              }}
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
            >
              {members.map(m => <option key={m.userId} value={m.userId}>{m.name || m.email}</option>)}
            </select>
          </div>

          {/* Split Between */}
          {members.length > 1 && (
            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300">⚡ Split Between</label>
                <div className="flex gap-1">
                  {["equal", "custom", "percentage"].map(t => (
                    <button key={t} type="button" onClick={() => setForm(f => ({ ...f, splitType: t }))}
                      className={`text-[10px] px-2 py-0.5 rounded font-bold transition ${form.splitType === t ? "bg-sky-500 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Member checkboxes */}
              <div className="space-y-2">
                {members.map(m => {
                  const checked = splitMembers.includes(m.userId);
                  const split   = computedSplits().find(s => s.userId === m.userId);
                  return (
                    <div key={m.userId} className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleSplitMember(m.userId)}
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition ${checked ? "bg-sky-500 border-sky-500" : "border-gray-600"}`}>
                        {checked && <span className="text-white text-[9px] font-black">✓</span>}
                      </button>
                      <span className="text-xs text-gray-300 flex-1">{m.name || m.email}</span>

                      {checked && form.splitType === "custom" && (
                        <input type="number" min="0" placeholder="0"
                          value={customAmounts[m.userId] || ""}
                          onChange={e => setCustomAmounts(prev => ({ ...prev, [m.userId]: e.target.value }))}
                          className="w-24 bg-slate-900 border border-white/10 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                      )}
                      {checked && form.splitType === "percentage" && (
                        <div className="flex items-center gap-1">
                          <input type="number" min="0" max="100" placeholder="0"
                            value={customPcts[m.userId] || ""}
                            onChange={e => setCustomPcts(prev => ({ ...prev, [m.userId]: e.target.value }))}
                            className="w-16 bg-slate-900 border border-white/10 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-indigo-500" />
                          <span className="text-[10px] text-gray-500">%</span>
                        </div>
                      )}
                      {checked && form.splitType !== "none" && split && (
                        <span className="text-xs text-emerald-400 font-bold w-16 text-right">{fmt(split.amount)}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Validation */}
              {amt > 0 && form.splitType === "custom" && (
                <div className={`text-xs flex justify-between font-bold ${Math.abs(splitTotal() - amt) > 0.5 ? "text-red-400" : "text-emerald-400"}`}>
                  <span>Total split</span>
                  <span>{fmt(splitTotal())} / {fmt(amt)}</span>
                </div>
              )}
              {amt > 0 && form.splitType === "percentage" && (
                <div className={`text-xs flex justify-between font-bold ${Math.abs(pctTotal() - 100) > 0.5 ? "text-red-400" : "text-emerald-400"}`}>
                  <span>Total %</span>
                  <span>{pctTotal().toFixed(1)}% / 100%</span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes (optional)</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Add any notes..."
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-sky-500 resize-none transition" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 py-2.5 rounded-xl text-sm font-bold text-gray-300 transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition">
              {saving ? "Saving..." : editingExpense ? "Update" : "Add Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN BudgetTab
   ═══════════════════════════════════════════════════════════════ */
export default function BudgetTab({ activeTrip, refreshTrips }) {
  const { user } = useAuth();
  const [tab, setTab]           = useState("overview");
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary]   = useState({ balances: [], settlements: [] });
  const [settled, setSettled]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showAdd,  setShowAdd]  = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [detailExp, setDetailExp] = useState(null);

  const members = (activeTrip?.participants || []).filter(p => p.status === "accepted");

  const fetchAll = useCallback(async () => {
    if (!activeTrip?._id) return;
    setLoading(true);
    try {
      const [exps, summ, setts] = await Promise.all([
        getExpenses(activeTrip._id),
        getExpenseSummary(activeTrip._id),
        listSettlements(activeTrip._id),
      ]);
      setExpenses(exps);
      setSummary(summ);
      setSettled(setts.settlements || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [activeTrip?._id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!activeTrip) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p className="text-lg font-bold">No active trip selected</p>
        <p className="text-sm mt-1">Select a trip first to track expenses.</p>
      </div>
    );
  }

  const totalBudget   = Number(activeTrip.budget || 0);
  const actualTotal   = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const remaining     = totalBudget - actualTotal;
  const pctSpent      = totalBudget > 0 ? Math.min(100, Math.round((actualTotal / totalBudget) * 100)) : 0;
  const isOver        = remaining < 0;
  const isLow         = !isOver && remaining > 0 && remaining < totalBudget * 0.15;

  // Per-category totals
  const catTotals = {};
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount || 0); });

  const TABS = [
    { id: "overview",  label: "📊 Overview"     },
    { id: "expenses",  label: "💳 Expenses"     },
    { id: "balances",  label: "⚖️ Who Owes What" },
    { id: "settle",    label: "✅ Settle Up"     },
  ];

  return (
    <div className="p-5 text-white max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-extrabold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            Budget & Expenses
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">{activeTrip.tripName} · {activeTrip.city}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-lg shadow-sky-500/20"
        >
          + Add Expense
        </button>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Budget",   value: fmt(totalBudget),   cls: "text-gray-100"  },
          { label: "Spent",          value: fmt(actualTotal),   cls: "text-indigo-400" },
          { label: "Remaining",      value: fmt(remaining),     cls: isOver ? "text-red-400" : isLow ? "text-amber-400" : "text-emerald-400" },
          { label: "% Used",         value: `${pctSpent}%`,     cls: isOver ? "text-red-400" : "text-sky-400" },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/50 border border-white/5 p-3 rounded-2xl">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Budget progress bar */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Spent: {fmt(actualTotal)}</span>
          <span>Budget: {fmt(totalBudget)}</span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isOver ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-gradient-to-r from-sky-500 to-indigo-500"}`}
            style={{ width: `${Math.min(pctSpent, 100)}%` }}
          />
        </div>
        {(isOver || isLow) && (
          <p className={`text-xs mt-2 font-semibold ${isOver ? "text-red-400" : "text-amber-400"}`}>
            {isOver ? `🚨 Over budget by ${fmt(Math.abs(remaining))}` : `⚠️ Only ${fmt(remaining)} remaining (under 15%)`}
          </p>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-800/40 rounded-xl p-1 mb-5 overflow-x-auto">
        {TABS.map(t => <MiniTab key={t.id} id={t.id} label={t.label} active={tab === t.id} onClick={setTab} />)}
      </div>

      {loading && (
        <div className="text-center py-10 text-gray-500 animate-pulse">Loading expense data...</div>
      )}

      {!loading && (
        <>
          {/* ── OVERVIEW TAB ─────────────────────────────── */}
          {tab === "overview" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-300">Per-Category Breakdown</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(CAT_META).map(([cat, meta]) => {
                  const catAmt   = catTotals[cat] || 0;
                  const catPct   = actualTotal > 0 ? Math.round((catAmt / actualTotal) * 100) : 0;
                  return (
                    <div key={cat} className={`${meta.bg} ${meta.border} border rounded-2xl p-3`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{meta.emoji}</span>
                        <span className="text-xs font-bold text-gray-300">{meta.label}</span>
                      </div>
                      <p className={`text-lg font-black ${meta.color}`}>{fmt(catAmt)}</p>
                      <div className="h-1 bg-black/20 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-current rounded-full" style={{ width: `${catPct}%`, color: "inherit" }} />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">{catPct}% of total</p>
                    </div>
                  );
                })}
              </div>

              {/* Per-member stats */}
              {members.length > 1 && summary.balances.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-300 mb-3">Per-Person Stats</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl">
                      <p className="text-xs text-gray-500 mb-2">💸 Highest Spender</p>
                      {(() => {
                        const top = [...summary.balances].sort((a, b) => b.paid - a.paid)[0];
                        return top ? <><p className="text-lg font-black text-white">{top.name}</p><p className="text-sm text-indigo-400">{fmt(top.paid)}</p></> : null;
                      })()}
                    </div>
                    <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl">
                      <p className="text-xs text-gray-500 mb-2">🎯 Average / Person</p>
                      <p className="text-lg font-black text-white">{fmt(members.length > 0 ? actualTotal / members.length : 0)}</p>
                      <p className="text-xs text-gray-500">across {members.length} members</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── EXPENSES TAB ─────────────────────────────── */}
          {tab === "expenses" && (
            <div>
              {expenses.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-4xl mb-3">💳</p>
                  <p className="font-bold text-gray-400">No expenses yet</p>
                  <p className="text-sm mt-1">Click "Add Expense" to log your first one</p>
                </div>
              )}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {expenses.map(exp => {
                  const meta = catMeta(exp.category);
                  return (
                    <div key={exp._id}
                      className="bg-slate-900/50 border border-white/5 hover:border-white/10 rounded-2xl p-4 cursor-pointer transition"
                      onClick={() => setDetailExp(exp)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className={`${meta.bg} ${meta.border} border text-lg w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0`}>{meta.emoji}</span>
                          <div>
                            <p className="text-sm font-bold text-gray-100">{exp.title || exp.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] font-bold ${meta.color}`}>{meta.label}</span>
                              {exp.paidBy?.name && <span className="text-[10px] text-gray-500">· Paid by {exp.paidBy.name}</span>}
                              <span className="text-[10px] text-gray-600">· {new Date(exp.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                            </div>
                            {exp.splitType && exp.splitType !== "none" && exp.splits?.length > 0 && (
                              <p className="text-[10px] text-sky-400/70 mt-0.5">Split {exp.splitType} · {exp.splits.length} members</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-extrabold text-emerald-400">{fmt(exp.amount)}</span>
                          <button onClick={e => { e.stopPropagation(); setEditing(exp); setShowAdd(true); }}
                            className="bg-white/5 hover:bg-white/10 p-1.5 rounded-lg text-xs transition">✏️</button>
                          <button onClick={async e => { e.stopPropagation(); if (!confirm("Delete this expense?")) return; await deleteExpense(exp._id); fetchAll(); refreshTrips?.(); }}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 rounded-lg text-xs transition">🗑️</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── WHO OWES WHAT TAB ────────────────────────── */}
          {tab === "balances" && (
            <div>
              {summary.balances.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-4xl mb-3">⚖️</p>
                  <p className="font-bold text-gray-400">Add expenses with splits to see balances</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider px-4 pb-1">
                    <span>Member</span><span className="text-right">Paid</span><span className="text-right">Share</span><span className="text-right">Balance</span>
                  </div>
                  {summary.balances.map(b => {
                    const isPos = b.balance > 0.005;
                    const isNeg = b.balance < -0.005;
                    return (
                      <div key={b.userId} className={`grid grid-cols-4 items-center p-4 rounded-2xl border ${isPos ? "bg-emerald-500/5 border-emerald-500/20" : isNeg ? "bg-red-500/5 border-red-500/20" : "bg-slate-900/40 border-white/5"}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                            {(b.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-gray-200 truncate">{b.name}</span>
                        </div>
                        <span className="text-xs text-gray-300 text-right">{fmt(b.paid)}</span>
                        <span className="text-xs text-gray-300 text-right">{fmt(b.share)}</span>
                        <div className="text-right">
                          <span className={`text-sm font-black ${isPos ? "text-emerald-400" : isNeg ? "text-red-400" : "text-gray-400"}`}>
                            {isPos ? "+" : ""}{fmt(b.balance)}
                          </span>
                          {isPos && <p className="text-[9px] text-emerald-500 mt-0.5">Gets back</p>}
                          {isNeg && <p className="text-[9px] text-red-500 mt-0.5">Owes</p>}
                          {!isPos && !isNeg && <p className="text-[9px] text-gray-600 mt-0.5">Settled</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── SETTLE UP TAB ────────────────────────────── */}
          {tab === "settle" && (
            <div className="space-y-4">
              {/* Suggestions */}
              {summary.settlements.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-300 mb-3">💡 Suggested Settlements</h3>
                  <div className="space-y-2">
                    {summary.settlements.map((s, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-900/50 border border-amber-500/20 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-sm font-black text-red-400">
                            {(s.fromUserName || "?").charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">
                              <span className="text-red-400 font-bold">{s.fromUserName}</span>
                              <span className="text-gray-500"> pays </span>
                              <span className="text-emerald-400 font-bold">{s.toUserName}</span>
                            </p>
                            <p className="text-lg font-black text-amber-400">{fmt(s.amount)}</p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await createSettlement({ tripId: activeTrip._id, toUserId: s.toUserId, toUserName: s.toUserName, amount: s.amount });
                              fetchAll();
                            } catch (e) { alert(e.message); }
                          }}
                          className="bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 text-xs font-bold px-3 py-2 rounded-xl transition"
                        >
                          Record →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Settlement history */}
              {settled.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-300 mb-3">📜 Settlement History</h3>
                  <div className="space-y-2">
                    {settled.map(s => (
                      <div key={s._id} className={`flex items-center justify-between p-4 rounded-2xl border ${s.status === "settled" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-slate-900/50 border-white/5"}`}>
                        <div>
                          <p className="text-xs text-gray-300">
                            <span className="font-bold text-red-400">{s.fromUserName}</span>
                            <span className="text-gray-500"> → </span>
                            <span className="font-bold text-emerald-400">{s.toUserName}</span>
                          </p>
                          <p className="text-base font-black text-white mt-0.5">{fmt(s.amount)}</p>
                          {s.settledAt && <p className="text-[10px] text-gray-500 mt-0.5">Settled {new Date(s.settledAt).toLocaleDateString()}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${s.status === "settled" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20"}`}>
                            {s.status === "settled" ? "✅ Done" : "⏳ Pending"}
                          </span>
                          {s.status === "pending" && (
                            <button
                              onClick={async () => { try { await markSettled(s._id); fetchAll(); } catch (e) { alert(e.message); } }}
                              className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg transition font-bold"
                            >
                              Mark Settled
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.settlements.length === 0 && settled.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-4xl mb-3">✅</p>
                  <p className="font-bold text-gray-400">All settled!</p>
                  <p className="text-sm mt-1">No outstanding balances to settle</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add / Edit modal */}
      {showAdd && (
        <AddExpenseModal
          trip={activeTrip}
          members={members}
          editingExpense={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSaved={() => { fetchAll(); refreshTrips?.(); }}
        />
      )}

      {/* Expense detail modal */}
      {detailExp && (
        <div className="fixed inset-0 bg-black/70 z-[600] flex items-center justify-center p-4" onClick={() => setDetailExp(null)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="font-bold text-white">{detailExp.title || detailExp.description}</h3>
              <button onClick={() => setDetailExp(null)} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center text-sm transition">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-3xl font-black text-emerald-400">{fmt(detailExp.amount)}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Category</span><span className="text-gray-200">{catMeta(detailExp.category).emoji} {catMeta(detailExp.category).label}</span></div>
                {detailExp.paidBy?.name && <div className="flex justify-between"><span className="text-gray-500">Paid by</span><span className="text-gray-200">{detailExp.paidBy.name}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="text-gray-200">{new Date(detailExp.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span></div>
                {detailExp.notes && <div className="flex justify-between"><span className="text-gray-500">Notes</span><span className="text-gray-200">{detailExp.notes}</span></div>}
              </div>
              {detailExp.splits?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Split ({detailExp.splitType})</p>
                  <div className="space-y-1.5">
                    {detailExp.splits.map(s => (
                      <div key={s.userId} className="flex justify-between text-sm">
                        <span className="text-gray-300">{s.name}</span>
                        <span className="text-emerald-400 font-bold">{fmt(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
