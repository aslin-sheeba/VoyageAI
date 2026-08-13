import { useState, useEffect } from "react";
import { getExpenses, addExpense, deleteExpense, updateExpense } from "../api/expenseService";

export default function BudgetTab({ activeTrip, refreshTrips }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    category: "food",
    description: "",
    amount: "",
    date: "",
    notes: ""
  });
  
  const [saving, setSaving] = useState(false);

  const categories = [
    { value: "hotel", label: "🏨 Hotel" },
    { value: "food", label: "🍔 Food" },
    { value: "activities", label: "🎯 Activities" },
    { value: "transportation", label: "🚗 Transportation" },
    { value: "shopping", label: "🛍️ Shopping" },
    { value: "other", label: "📦 Other" }
  ];

  const fetchExpenses = async () => {
    if (!activeTrip) return;
    setLoading(true);
    try {
      const list = await getExpenses(activeTrip._id);
      setExpenses(list);
    } catch (err) {
      console.error("Failed to load expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [activeTrip]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeTrip) return;
    setSaving(true);

    try {
      const payload = {
        tripId: activeTrip._id,
        category: formData.category,
        description: formData.description,
        amount: Number(formData.amount),
        date: formData.date ? new Date(formData.date) : new Date(),
        notes: formData.notes
      };

      if (editingExpense) {
        await updateExpense(editingExpense._id, payload);
        setEditingExpense(null);
      } else {
        await addExpense(payload);
      }

      setFormData({
        category: "food",
        description: "",
        amount: "",
        date: "",
        notes: ""
      });

      await fetchExpenses();
      await refreshTrips();
    } catch (err) {
      alert("Failed to save expense log.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (exp) => {
    setEditingExpense(exp);
    setFormData({
      category: exp.category,
      description: exp.description,
      amount: exp.amount,
      date: exp.date ? exp.date.substring(0, 10) : "",
      notes: exp.notes || ""
    });
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this expense log?")) return;
    try {
      await deleteExpense(id);
      await fetchExpenses();
      await refreshTrips();
    } catch (err) {
      alert("Failed to delete expense.");
    }
  };

  if (!activeTrip) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p className="text-lg font-bold">No active trip selected</p>
        <p className="text-sm mt-1">Please select or plan a trip first to track expenses.</p>
      </div>
    );
  }

  // Cost summaries
  const totalBudget    = Number(activeTrip.budget || 0);
  const estimatedCost  = (activeTrip.locations || []).reduce((sum, loc) => sum + Number(loc.cost || 0), 0);
  const actualCost     = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const remainingBudget = totalBudget - actualCost;

  // Participant breakdown
  const acceptedCount  = (activeTrip.participants || []).filter(p => p.status === "accepted").length || 1;
  const budgetPerPerson = acceptedCount > 0 ? Math.round(totalBudget / acceptedCount) : totalBudget;
  const spentPerPerson  = acceptedCount > 0 ? Math.round(actualCost  / acceptedCount) : actualCost;

  // Warning thresholds
  const isOverEstimated = estimatedCost > totalBudget;
  const isRemainingLow = remainingBudget > 0 && remainingBudget < (totalBudget * 0.15); // under 15%
  const isOverBudget = remainingBudget < 0;

  return (
    <div className="p-6 text-white max-w-4xl mx-auto pb-6">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">Budget & Expenses</h2>
        <p className="text-gray-400 text-sm mt-1">Track estimated itinerary costs against logged manual expenses</p>
      </div>

      {/* STATS TILES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl">
          <span className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Budget</span>
          <span className="text-2xl font-black text-gray-100">₹{totalBudget.toLocaleString("en-IN")}</span>
        </div>
        <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl">
          <span className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Est. Cost</span>
          <span className={`text-2xl font-black ${isOverEstimated ? "text-red-400" : "text-sky-400"}`}>
            ₹{estimatedCost.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl">
          <span className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Actual Expenses</span>
          <span className="text-2xl font-black text-indigo-400">₹{actualCost.toLocaleString("en-IN")}</span>
        </div>
        <div className={`p-4 rounded-2xl border transition-all duration-300 ${
          isOverBudget 
            ? "bg-red-500/10 border-red-500/30" 
            : isRemainingLow 
            ? "bg-amber-500/10 border-amber-500/30" 
            : "bg-emerald-500/10 border-emerald-500/30"
        }`}>
          <span className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Remaining</span>
          <span className={`text-2xl font-black ${
            isOverBudget ? "text-red-400" : isRemainingLow ? "text-amber-400" : "text-emerald-400"
          }`}>
            ₹{remainingBudget.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* PER-PERSON BREAKDOWN */}
      {acceptedCount > 1 && (
        <div className="bg-slate-900/50 border border-sky-500/20 p-4 rounded-2xl mb-6 flex flex-wrap gap-6">
          <div>
            <span className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">👥 Participants</span>
            <span className="text-xl font-black text-white">{acceptedCount}</span>
          </div>
          <div>
            <span className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Budget / Person</span>
            <span className="text-xl font-black text-sky-400">₹{budgetPerPerson.toLocaleString("en-IN")}</span>
          </div>
          <div>
            <span className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Actual Spent / Person</span>
            <span className={`text-xl font-black ${spentPerPerson > budgetPerPerson ? "text-red-400" : "text-emerald-400"}`}>
              ₹{spentPerPerson.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}

      {/* WARNING NOTIFICATIONS */}
      {isOverEstimated && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-4 flex items-center gap-2">
          <span>⚠️</span>
          <span>Your planned itinerary (₹{estimatedCost.toLocaleString("en-IN")}) exceeds your total budget by ₹{(estimatedCost - totalBudget).toLocaleString("en-IN")}.</span>
        </div>
      )}
      {isRemainingLow && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-xl text-sm mb-4 flex items-center gap-2">
          <span>⚠️</span>
          <span>Warning: Your remaining budget is low (only ₹{remainingBudget.toLocaleString("en-IN")} left).</span>
        </div>
      )}
      {isOverBudget && (
        <div className="bg-red-500/25 border border-red-500/40 text-red-300 px-4 py-3 rounded-xl text-sm mb-4 flex items-center gap-2">
          <span>🚨</span>
          <span>You have exceeded your total budget limit by ₹{Math.abs(remainingBudget).toLocaleString("en-IN")}!</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LOG FORM */}
        <div className="md:col-span-1 bg-slate-900/50 border border-white/5 p-5 rounded-2xl h-fit">
          <h3 className="text-lg font-bold mb-4">{editingExpense ? "✏️ Edit Expense" : "➕ Log Expense"}</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-slate-800 border border-white/10 rounded-xl p-2 focus:outline-none text-sm text-gray-200"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <input 
                type="text" 
                required
                placeholder="e.g. Uber to airport, dinner..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-800 border border-white/10 rounded-xl p-2 text-sm text-gray-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Amount (INR)</label>
              <input 
                type="number" 
                required
                placeholder="500"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full bg-slate-800 border border-white/10 rounded-xl p-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Date</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-800 border border-white/10 rounded-xl p-2 text-sm text-gray-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Notes (Optional)</label>
              <textarea 
                rows="2"
                placeholder="Add receipt notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full bg-slate-800 border border-white/10 rounded-xl p-2 text-sm text-gray-200 focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              {editingExpense && (
                <button 
                  type="button"
                  onClick={() => {
                    setEditingExpense(null);
                    setFormData({ category: "food", description: "", amount: "", date: "", notes: "" });
                  }}
                  className="flex-1 bg-white/5 hover:bg-white/10 py-2 rounded-xl text-sm transition"
                >
                  Cancel
                </button>
              )}
              <button 
                type="submit"
                disabled={saving}
                className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 rounded-xl text-sm transition disabled:opacity-50"
              >
                {saving ? "Saving..." : editingExpense ? "Update" : "Add Log"}
              </button>
            </div>
          </form>
        </div>

        {/* LOGGED EXPENSES LIST */}
        <div className="md:col-span-2 bg-slate-900/50 border border-white/5 p-5 rounded-2xl">
          <h3 className="text-lg font-bold mb-4">📜 Expense Logs</h3>

          {loading && (
            <div className="text-center py-6 text-gray-400">Loading expense logs...</div>
          )}

          {!loading && expenses.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">
              No manual expenses logged yet. Log your first expense using the form.
            </div>
          )}

          {!loading && expenses.length > 0 && (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {expenses.map((exp) => (
                <div key={exp._id} className="bg-slate-900 border border-white/5 p-4 rounded-xl flex justify-between items-center hover:border-white/10 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-indigo-300 font-bold uppercase tracking-wider">
                        {exp.category}
                      </span>
                      <span className="text-xs text-gray-500">{new Date(exp.date).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-bold text-slate-200 mt-1.5">{exp.description}</h4>
                    {exp.notes && <p className="text-xs text-gray-400 mt-0.5">Note: {exp.notes}</p>}
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-extrabold text-indigo-400">₹{exp.amount}</span>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => handleEdit(exp)}
                        className="bg-white/5 hover:bg-white/10 p-1.5 rounded text-xs"
                        title="Edit log"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDelete(exp._id)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 rounded text-xs"
                        title="Delete log"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
