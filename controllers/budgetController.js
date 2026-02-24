import User from "../models/User.js";

/**
 * Set or update user's monthly budget.
 * Month format: YYYY-MM (defaults to current month)
 */
export const setMonthlyBudget = async (req, res) => {
  try {
    const userId = req.user._id;
    let { monthlyBudget, month } = req.body;

    monthlyBudget = Number(monthlyBudget);

    // Default to current month if not provided
    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}`;
    }

    if (isNaN(monthlyBudget) || monthlyBudget < 0) {
      return res.status(400).json({ message: "Invalid monthly budget" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.monthlyBudgets.set(month, monthlyBudget);
    await user.save();

    res.status(200).json({
      message: "Monthly budget set successfully",
      month,
      monthlyBudget
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to set monthly budget",
      error: error.message
    });
  }
};


/**
 * Fetch monthly budget for a given month.
 * Returns null if budget is not set.
 */
export const getMonthlyBudget = async (req, res) => {
  try {
    const userId = req.user._id;
    let { month } = req.query;

    // Default to current month
    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}`;
    }

    const user = await User.findById(userId).select("monthlyBudgets");
    if (!user) return res.status(404).json({ message: "User not found" });

    const monthlyBudget = user.monthlyBudgets.get(month);

    res.status(200).json({
      month,
      monthlyBudget: monthlyBudget ?? null
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch monthly budget",
      error: error.message
    });
  }
};


/**
 * Delete a specific month's budget.
 */
export const deleteMonthlyBudget = async (req, res) => {
  try {
    const userId = req.user._id;
    const { month } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.monthlyBudgets.delete(month);
    await user.save();

    res.status(200).json({
      message: "Monthly budget deleted"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete monthly budget",
      error: error.message
    });
  }
};


/**
 * Set category-wise budget for a month.
 * Ensures total category budgets do not exceed monthly budget.
 */
export const setCategoryBudget = async (req, res) => {
  try {
    const userId = req.user._id;
    let { category, amount, month } = req.body;

    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}`;
    }

    amount = Number(amount);
    if (!category?.trim() || isNaN(amount) || amount < 0) {
      return res.status(400).json({ message: "Invalid data" });
    }

    // Normalize category naming to avoid duplicates (food vs Food)
    const normalizedCategory =
      category.trim().charAt(0).toUpperCase() +
      category.trim().slice(1).toLowerCase();

    const user = await User.findById(userId);

    if (!user.categories.includes(normalizedCategory)) {
      user.categories.push(normalizedCategory);
    }

    if (!user.categoryBudgets.has(month)) {
      user.categoryBudgets.set(month, new Map());
    }

    /**
     * Recalculate total category allocation
     * to ensure it does not exceed monthly limit.
     */
    const monthBudgets = user.categoryBudgets.get(month) || new Map();

    let total = 0;
    for (const value of monthBudgets.values()) {
      total += value;
    }

    // Adjust total when updating existing category
    if (monthBudgets.has(normalizedCategory)) {
      total -= monthBudgets.get(normalizedCategory);
    }
    total += amount;

    const monthlyLimit = user.monthlyBudgets.get(month);

    if (monthlyLimit !== undefined && total > monthlyLimit) {
      return res.status(400).json({
        message: `Category budgets exceed monthly budget (${monthlyLimit})`,
        totalCategoryBudget: total,
        monthlyBudget: monthlyLimit
      });
    }

    user.categoryBudgets.get(month).set(normalizedCategory, amount);
    await user.save();

    res.status(200).json({
      month,
      category: normalizedCategory,
      amount
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update category budget",
      error: error.message
    });
  }
};


/**
 * Delete category budget for a specific month.
 * Important: nested Map mutation requires markModified().
 */
export const deleteCategoryBudget = async (req, res) => {
  try {
    const userId = req.user._id;
    const { month, category } = req.params;

    if (!month || !category) {
      return res.status(400).json({ message: "Month and category required" });
    }

    const normalizedCategory =
      category.trim().charAt(0).toUpperCase() +
      category.trim().slice(1).toLowerCase();

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const monthBudgets = user.categoryBudgets.get(month);

    if (!monthBudgets) {
      return res.status(404).json({ message: "Month budget not found" });
    }

    monthBudgets.delete(normalizedCategory);

    // Required because Mongoose does not track deep Map mutations automatically
    user.markModified("categoryBudgets");

    // Remove empty month container
    if (monthBudgets.size === 0) {
      user.categoryBudgets.delete(month);
    }

    await user.save();

    res.status(200).json({
      message: "Category budget deleted",
      month,
      category: normalizedCategory,
    });
  } catch (error) {
    console.error("DELETE CATEGORY ERROR:", error);
    res.status(500).json({
      message: "Failed to delete category budget",
      error: error.message,
    });
  }
};