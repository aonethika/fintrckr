import Group from "../models/Group.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";

/**
 * Create a group expense split.
 * - Creates master group transaction
 * - Adds split message to group chat
 * - Creates personal expense for payer's own share
 */
export const createGroupSplit = async (req, res) => {
  try {
    const creatorId = req.user._id;
    const { groupId } = req.params;
    const { title, amount, payer, splits } = req.body;

    // Support both populated object and raw id
    const payerId = typeof payer === "object" ? payer._id || payer.id : payer;

    if (!title || !amount || !payerId || !splits || !splits.length) {
      return res.status(400).json({ message: "Missing fields or splits" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Mark payer share as already paid
    const formattedSplits = splits.map((s) => ({
      user: s.user,
      amount: s.amount,
      status: s.user?.toString() === payerId?.toString() ? "paid" : "unpaid",
    }));

    // Master group expense
    const expense = await Transaction.create({
      title,
      amount,
      group: groupId,
      creator: creatorId,
      payer: payerId,
      user: creatorId,
      transactionType: "expense",
      category: "Group Split",
      isGroupTransaction: true,
      splits: formattedSplits,
    });

    const creatorUser = await User.findById(creatorId).select("_id name email");

    // Push split event into group chat
    await Group.findByIdAndUpdate(groupId, {
      $push: {
        messages: {
          type: "split",
          sender: creatorUser,
          creator: creatorUser,
          expense: expense._id,
          title,
          amount,
          payer: payerId,
          splits: formattedSplits,
          createdAt: new Date(),
        },
      },
      status: "active",
    });

    // Personal transaction: payer spends only their own share
    const payerShare =
      formattedSplits.find(
        (s) => s.user.toString() === payerId.toString()
      )?.amount || 0;

    await Transaction.create({
      user: payerId,
      payer: payerId,
      title: `${title} - your share`,
      category: "Group Split",
      amount: payerShare,
      transactionType: "expense",
      date: new Date(),
      isGroupTransaction: false,
    });

    res.status(201).json({ expense, message: "Split created" });

  } catch (err) {
    console.error("CREATE SPLIT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};


/**
 * Member marks their split as paid.
 * Status flow: unpaid → requested → paid
 */
export const markSplitAsPaid = async (req, res) => {
  try {
    const userId = req.user._id;
    const { expenseId } = req.params;

    const expense = await Transaction.findById(expenseId);
    if (!expense)
      return res.status(404).json({ message: "Expense not found" });

    // Payer cannot request payment confirmation
    if (expense.payer?.toString() === userId.toString()) {
      return res.status(403).json({ message: "Payer cannot mark payment" });
    }

    const split = expense.splits.find(
      (s) => s.user?.toString() === userId.toString()
    );

    if (!split) return res.status(403).json({ message: "Not part of this split" });
    if (split.status !== "unpaid")
      return res.status(400).json({ message: "Already processed" });

    split.status = "requested";
    await expense.save();

    // Personal expense entry for paying member
    const payer = await User.findById(expense.payer).select("name");

    await Transaction.create({
      user: userId,
      payer: expense.payer,
      memberName: payer?.name || null,
      title: `Payment for ${expense.title} to ${payer?.name || "Payer"}`,
      category: "Group Split",
      amount: split.amount,
      transactionType: "expense",
      date: new Date(),
      isGroupTransaction: false,
    });

    // Notify group chat
    await Group.findByIdAndUpdate(expense.group, {
      $push: {
        messages: {
          type: "payment_requested",
          sender: userId,
          text: `Marked ${split.amount} as paid`,
          expense: expense._id,
          amount: split.amount,
          user: split.user,
          createdAt: new Date(),
        },
      },
      status: "active",
    });

    res.json({
      message: "Payment marked, awaiting payer confirmation",
      expense,
    });

  } catch (err) {
    console.error("MARK PAID ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};


/**
 * Payer confirms member payment.
 * Updates split state and adjusts payer balance.
 */
export const confirmSplitPayment = async (req, res) => {
  try {
    const payerId = req.user._id;
    const { memberId } = req.body;
    const { expenseId } = req.params;

    const expense = await Transaction.findById(expenseId);
    if (!expense)
      return res.status(404).json({ message: "Expense not found" });

    // Only payer allowed to confirm
    if (!expense.payer || expense.payer.toString() !== payerId.toString()) {
      return res.status(403).json({ message: "Only payer can confirm payments" });
    }

    const split = expense.splits.find(
      (s) => s.user?.toString() === memberId.toString()
    );

    if (!split || split.status !== "requested")
      return res.status(400).json({ message: "No pending payment" });

    split.status = "paid";
    split.paidAt = new Date();
    await expense.save();

    // Reduce payer's outstanding personal expense
    const payerExpense = await Transaction.findOne({
      user: payerId,
      title: `${expense.title} - your share`,
      transactionType: "expense",
      isGroupTransaction: false,
    });

    if (payerExpense) {
      payerExpense.amount = Math.max(payerExpense.amount - split.amount, 0);
      await payerExpense.save();
    }

    const member = await User.findById(memberId).select("name");

    const messagesToPush = [
      {
        type: "payment_confirmed_member",
        sender: payerId,
        receiver: memberId,
        text: `Payer confirmed your payment of ₹${split.amount} for ${expense.title}`,
        expense: expense._id,
        amount: split.amount,
        user: memberId,
        createdAt: new Date(),
      },
      {
        type: "split_settled",
        sender: payerId,
        text: `${member?.name} paid ₹${split.amount} for ${expense.title}`,
        expense: expense._id,
        amount: split.amount,
        user: split.user,
        createdAt: new Date(),
      },
    ];

    // Notify when entire expense is settled
    const allPaid = expense.splits.every((s) => s.status === "paid");

    if (allPaid) {
      messagesToPush.push({
        type: "group_fully_settled",
        sender: payerId,
        text: ` Group expense "${expense.title}" fully settled`,
        expense: expense._id,
        createdAt: new Date(),
      });
    }

    await Group.findByIdAndUpdate(expense.group, {
      $push: { messages: messagesToPush },
    });

    // Update group active/inactive status based on pending splits
    const groupTransactions = await Transaction.find({
      group: expense.group,
      isGroupTransaction: true,
    });

    const hasPending = groupTransactions.some(tx =>
      tx.splits.some(
        s =>
          s.user.toString() !== tx.payer.toString() &&
          s.status !== "paid"
      )
    );

    await Group.findByIdAndUpdate(
      expense.group,
      { status: hasPending ? "active" : "inactive" },
      { new: true }
    );

    const group = await Group.findById(expense.group);

    res.json({
      message: "Payment confirmed successfully",
      expense,
      group,
    });

  } catch (err) {
    console.error("CONFIRM PAYMENT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};


/**
 * Returns user's group split summary:
 * - total amount owed
 * - total amount to receive
 */
export const getGroupSplitSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    const transactions = await Transaction.find({
      $or: [
        { payer: userId },
        { "splits.user": userId }
      ],
      isGroupTransaction: true
    });

    let owe = 0;
    let toReceive = 0;

    transactions.forEach(t => {
      if (t.splits?.length) {
        t.splits.forEach(s => {

          // Member owes money
          if (s.user.toString() === userId.toString() && s.status === "unpaid") {
            owe += s.amount;
          }

          // Others owe payer
          if (
            t.payer?.toString() === userId.toString() &&
            s.user.toString() !== userId.toString() &&
            s.status === "unpaid"
          ) {
            toReceive += s.amount;
          }
        });
      }
    });

    res.status(200).json({ owe, toReceive });

  } catch (err) {
    console.error("GROUP SPLIT SUMMARY ERROR:", err);
    res.status(500).json({
      message: "Failed to fetch group split summary",
      error: err.message,
    });
  }
};