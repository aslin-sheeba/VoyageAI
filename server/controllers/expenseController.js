import Expense    from "../models/Expense.js";
import Trip       from "../models/Trip.js";
import Settlement from "../models/Settlement.js";
import { connectDB } from "../db.js";
import { createNotifications, logActivity } from "../services/notificationHelper.js";
import { getIO } from "../services/socketManager.js";

/* ───────────────────────────────────────────────────────────
   HELPER: verify trip access — owner OR accepted participant
   ─────────────────────────────────────────────────────────── */
const checkTripAccess = async (tripId, userId) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error("Trip not found");
  const isOwner  = trip.userId === userId;
  const isMember = trip.participants?.some(p => p.userId === userId && p.status === "accepted");
  if (!isOwner && !isMember) throw new Error("Forbidden: You do not have access to this trip");
  return trip;
};

/* ───────────────────────────────────────────────────────────
   HELPER: validate that splits add up correctly
   ─────────────────────────────────────────────────────────── */
function validateSplits(amount, splitType, splits) {
  if (!splitType || splitType === "none" || splits.length === 0) return null;

  const eps = 0.01; // floating point tolerance

  if (splitType === "equal") {
    const each = amount / splits.length;
    for (const s of splits) {
      if (Math.abs(s.amount - each) > eps * splits.length) {
        return `Equal split mismatch: each share should be ₹${each.toFixed(2)}`;
      }
    }
  }

  if (splitType === "custom") {
    const total = splits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    if (Math.abs(total - amount) > eps) {
      return `Custom split total (₹${total.toFixed(2)}) does not equal expense amount (₹${amount.toFixed(2)})`;
    }
  }

  if (splitType === "percentage") {
    const totalPct = splits.reduce((sum, s) => sum + Number(s.percentage || 0), 0);
    if (Math.abs(totalPct - 100) > eps) {
      return `Percentage split must total 100% (currently ${totalPct.toFixed(1)}%)`;
    }
    // Ensure amount is also set correctly
    for (const s of splits) {
      s.amount = parseFloat(((s.percentage / 100) * amount).toFixed(2));
    }
  }

  return null;
}

/* ───────────────────────────────────────────────────────────
   POST /api/expenses
   ─────────────────────────────────────────────────────────── */
export const createExpense = async (req, res) => {
  try {
    await connectDB();
    const { tripId, category, description, title, amount, date, notes, paidBy, splitType, splits } = req.body;
    const userId = req.user.uid;

    if (!tripId || !category || amount === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields: tripId, category, amount" });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: "Expense amount must be greater than 0" });
    }

    let trip;
    try { trip = await checkTripAccess(tripId, userId); }
    catch (err) {
      return res.status(err.message.includes("Forbidden") ? 403 : 404).json({ success: false, error: err.message });
    }

    // Validate splits server-side
    const parsedSplits  = (splits || []).map(s => ({ ...s, amount: Number(s.amount || 0), percentage: Number(s.percentage || 0) }));
    const splitError    = validateSplits(Number(amount), splitType, parsedSplits);
    if (splitError) return res.status(400).json({ success: false, error: splitError });

    const resolvedTitle = title || description || "Expense";

    const expense = await Expense.create({
      tripId,
      userId,
      title:       resolvedTitle,
      description: resolvedTitle, // keep legacy field in sync
      category,
      amount:      Number(amount),
      date:        date || new Date(),
      notes:       notes || "",
      paidBy:      paidBy || { userId, name: req.user.name || req.user.displayName || "You" },
      splitType:   splitType || "none",
      splits:      parsedSplits,
    });

    // Notify other accepted members
    const otherMembers = (trip.participants || [])
      .filter(p => p.status === "accepted" && p.userId !== userId)
      .map(p => p.userId);

    const paidByName = paidBy?.name || req.user.name || req.user.displayName || "Someone";

    await createNotifications({
      userIds: otherMembers,
      tripId,
      type: "expense_added",
      title: "New expense added",
      message: `${paidByName} added ₹${Number(amount).toLocaleString("en-IN")} · ${category}`,
      metadata: { expenseId: expense._id },
      getIO,
    });

    // Log activity
    await logActivity({
      tripId,
      userId,
      userName: paidByName,
      action: `added ₹${Number(amount).toLocaleString("en-IN")} expense · ${resolvedTitle} (${category})`,
      category: "expense",
      metadata: { expenseId: expense._id },
      getIO,
    });

    res.status(201).json({ success: true, expense });
  } catch (err) {
    console.error("Create expense error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ───────────────────────────────────────────────────────────
   GET /api/expenses/trip/:tripId
   ─────────────────────────────────────────────────────────── */
export const getExpensesByTrip = async (req, res) => {
  try {
    await connectDB();
    const { tripId } = req.params;
    const userId = req.user.uid;

    try { await checkTripAccess(tripId, userId); }
    catch (err) {
      return res.status(err.message.includes("Forbidden") ? 403 : 404).json({ success: false, error: err.message });
    }

    const expenses = await Expense.find({ tripId }).sort({ date: -1 });
    res.json({ success: true, expenses });
  } catch (err) {
    console.error("Get expenses error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ───────────────────────────────────────────────────────────
   GET /api/expenses/trip/:tripId/summary
   Returns per-member balances + minimal settlement suggestions
   ─────────────────────────────────────────────────────────── */
export const getExpenseSummary = async (req, res) => {
  try {
    await connectDB();
    const { tripId } = req.params;
    const userId = req.user.uid;

    let trip;
    try { trip = await checkTripAccess(tripId, userId); }
    catch (err) {
      return res.status(err.message.includes("Forbidden") ? 403 : 404).json({ success: false, error: err.message });
    }

    const expenses = await Expense.find({ tripId });

    // Build member map from accepted participants
    const members = (trip.participants || []).filter(p => p.status === "accepted");
    const memberMap = {};
    members.forEach(m => {
      memberMap[m.userId] = { userId: m.userId, name: m.name || m.email, paid: 0, share: 0 };
    });

    // Calculate paid and share per member
    expenses.forEach(exp => {
      const paidById = exp.paidBy?.userId || exp.userId;
      if (memberMap[paidById]) {
        memberMap[paidById].paid += Number(exp.amount || 0);
      }

      if (exp.splitType !== "none" && exp.splits?.length > 0) {
        exp.splits.forEach(s => {
          if (memberMap[s.userId]) {
            memberMap[s.userId].share += Number(s.amount || 0);
          }
        });
      } else {
        // No split — treat as equal among all accepted members
        const share = Number(exp.amount || 0) / (members.length || 1);
        members.forEach(m => {
          if (memberMap[m.userId]) memberMap[m.userId].share += share;
        });
      }
    });

    // Balance = paid - share (positive = owed money, negative = owes money)
    const balances = Object.values(memberMap).map(m => ({
      ...m,
      balance: parseFloat((m.paid - m.share).toFixed(2)),
    }));

    // Minimal settlement algorithm (greedy debt reduction)
    const settlements = calculateMinimalSettlements(balances);

    res.json({ success: true, balances, settlements });
  } catch (err) {
    console.error("Expense summary error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Greedy minimal-transactions algorithm.
 * Finds the smallest number of payments to settle all debts.
 */
function calculateMinimalSettlements(balances) {
  const creditors = balances.filter(b => b.balance > 0.005).map(b => ({ ...b }));
  const debtors   = balances.filter(b => b.balance < -0.005).map(b => ({ ...b }));

  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => a.balance - b.balance);

  const result = [];
  let ci = 0, di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt   = debtors[di];
    const amount = Math.min(credit.balance, -debt.balance);

    result.push({
      fromUserId:   debt.userId,
      fromUserName: debt.name,
      toUserId:     credit.userId,
      toUserName:   credit.name,
      amount:       parseFloat(amount.toFixed(2)),
    });

    credit.balance -= amount;
    debt.balance   += amount;

    if (Math.abs(credit.balance) < 0.005) ci++;
    if (Math.abs(debt.balance)   < 0.005) di++;
  }

  return result;
}

/* ───────────────────────────────────────────────────────────
   PUT /api/expenses/:id
   ─────────────────────────────────────────────────────────── */
export const updateExpense = async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    const { category, description, title, amount, date, notes, paidBy, splitType, splits } = req.body;
    const userId = req.user.uid;

    const expense = await Expense.findById(id);
    if (!expense) return res.status(404).json({ success: false, error: "Expense record not found" });

    try { await checkTripAccess(expense.tripId, userId); }
    catch (err) { return res.status(403).json({ success: false, error: "Forbidden: Access denied" }); }

    const parsedSplits = (splits || expense.splits || []).map(s => ({
      ...s, amount: Number(s.amount || 0), percentage: Number(s.percentage || 0),
    }));
    const parsedAmount = amount !== undefined ? Number(amount) : expense.amount;
    const parsedType   = splitType || expense.splitType;

    if (amount !== undefined && parsedAmount <= 0) {
      return res.status(400).json({ success: false, error: "Amount must be greater than 0" });
    }

    const splitError = validateSplits(parsedAmount, parsedType, parsedSplits);
    if (splitError) return res.status(400).json({ success: false, error: splitError });

    const resolvedTitle = title || description || expense.title;
    if (resolvedTitle)            { expense.title = resolvedTitle; expense.description = resolvedTitle; }
    if (category)                   expense.category   = category;
    if (amount !== undefined)       expense.amount     = parsedAmount;
    if (date)                       expense.date       = date;
    if (notes !== undefined)        expense.notes      = notes;
    if (paidBy)                     expense.paidBy     = paidBy;
    if (splitType)                  expense.splitType  = parsedType;
    if (splits)                     expense.splits     = parsedSplits;

    await expense.save();
    res.json({ success: true, expense });
  } catch (err) {
    console.error("Update expense error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ───────────────────────────────────────────────────────────
   DELETE /api/expenses/:id
   ─────────────────────────────────────────────────────────── */
export const deleteExpense = async (req, res) => {
  try {
    await connectDB();
    const { id }  = req.params;
    const userId  = req.user.uid;

    const expense = await Expense.findById(id);
    if (!expense) return res.status(404).json({ success: false, error: "Expense record not found" });

    try { await checkTripAccess(expense.tripId, userId); }
    catch (err) { return res.status(403).json({ success: false, error: "Forbidden: Access denied" }); }

    await Expense.findByIdAndDelete(id);
    res.json({ success: true, message: "Expense deleted successfully" });
  } catch (err) {
    console.error("Delete expense error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
