import Transaction from "../models/Transaction.js";
import User from "../models/User.js";

/**
 * Get monthly financial summary for a user.
 * 
 * Calculates:
 * - Total income and expenses
 * - Pending group split payments
 * - Category-wise spending analysis
 * - Budget usage and warnings
 */
export const getMonthlySummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const { month, year } = req.query;

    // Format month key used for budget storage (YYYY-MM)
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    // Date range for selected month
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Fetch all user transactions within month
    const transactions = await Transaction.find({
      user: userId,
      date: { $gte: start, $lte: end }
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let pendingSplits = 0;

    const categoryExpenses = {};

    transactions.forEach(t => {
      /**
       * Group transactions:
       * - "requested" → pending payment
       * - "paid" → counted as expense
       */
      if (t.isGroupTransaction && t.splits?.length) {
        t.splits.forEach(s => {
          if (s.user.toString() === userId.toString()) {
            if (s.status === "requested") pendingSplits += s.amount;
            else if (s.status === "paid") totalExpense += s.amount;
          }
        });
      } else {
        // Normal transactions
        if (t.transactionType === "income") totalIncome += t.amount;
        else totalExpense += t.amount;
      }

      // Build category expense totals (exclude internal group category)
      if (t.transactionType === "expense" && t.category !== "Group Split") {
        if (!categoryExpenses[t.category])
          categoryExpenses[t.category] = 0;

        categoryExpenses[t.category] += t.amount;
      }
    });

    /* ---------- Monthly Budget ---------- */
    const monthlyBudget = user.monthlyBudgets?.get(monthKey) || 0;

    /* ---------- Category Budget Analysis ---------- */
    const monthCategoryBudgets =
      user.categoryBudgets?.get(monthKey) || new Map();

    const categoryAnalysis = {};
    const warnings = [];

    for (const [cat, spent] of Object.entries(categoryExpenses)) {
      if (cat === "Group Split") continue;

      // Budget may be unset for some categories
      const budget = monthCategoryBudgets.has(cat)
        ? monthCategoryBudgets.get(cat)
        : null;

      const overBudget = budget !== null && spent > budget;

      const percentSpent =
        budget !== null && budget > 0
          ? ((spent / budget) * 100).toFixed(2)
          : null;

      categoryAnalysis[cat] = {
        spent,
        budget,
        overBudget,
        percentSpent
      };

      // Generate warning signals for UI
      if (overBudget)
        warnings.push(`Category ${cat} exceeded budget by ${spent - budget}`);
      else if (percentSpent && percentSpent >= 90)
        warnings.push(`Category ${cat} is approaching its budget (${percentSpent}%)`);
    }

    const remainingBudget = monthlyBudget - totalExpense;

    if (remainingBudget < 0)
      warnings.push("Monthly budget exceeded");

    if (pendingSplits > 0)
      warnings.push(`Pending split payments: ${pendingSplits}`);

    res.status(200).json({
      month: monthKey,
      monthlyBudget,
      categoryBudgets: {
        [monthKey]: Object.fromEntries(monthCategoryBudgets)
      },
      totalIncome,
      totalExpense,
      pendingSplits,
      remainingBudget,
      categoryAnalysis,
      warnings
    });

  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch monthly summary",
      error: err.message
    });
  }
};