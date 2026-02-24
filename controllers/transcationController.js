import fs from "fs";
import path from "path";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";


export const createPersonalTransaction = async (req, res) => {
  try {
    const userId = req.user._id;
    let { title, category, amount, transactionType, date } = req.body;

    if (!title?.trim() || !category?.trim() || !transactionType) {
      return res.status(400).json({
        message: "Title, category and transaction type are required"
      });
    }

    amount = Number(amount);

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Amount must be a valid positive number"
      });
    }

    if (!["expense", "income"].includes(transactionType)) {
      return res.status(400).json({
        message: "Invalid transaction type"
      });
    }

    const trimmedCategory = category.trim();
    const normalizedCategory =
      trimmedCategory.charAt(0).toUpperCase() +
      trimmedCategory.slice(1).toLowerCase();

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingCategory = user.categories.some(
      (c) => c.toLowerCase() === normalizedCategory.toLowerCase()
    );

    if (!existingCategory) {
      user.categories.push(normalizedCategory);
      await user.save();
    }

    const imagePath = req.file
      ? `/uploads/transactions/${req.file.filename}`
      : null;

    const transaction = await Transaction.create({
      user: userId,
      payer: userId,
      title: title.trim(),
      category: normalizedCategory,
      amount,
      transactionType,
      date: date ? new Date(date) : new Date(),
      image: imagePath,
      isGroupTransaction: false
    });

    res.status(201).json({
      message: "New transaction created",
      transaction
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(500).json({
      message: "Failed to create transaction",
      error: error.message
    });
  }
};


export const getAllPersonalTransactions = async (req, res)=>{
    try{
        const userId = req.user._id;
        if(!userId) return res.status(404).json({message: "User not found"});

        const transactions = await Transaction.find({
            user: userId,
            isGroupTransaction: false
        }).sort({date: -1});

        res.status(200).json({
            transactions,
            count: transactions.length
        });
    }catch(error){
        console.error("Cannot find transactions error:", error);
        res.status(500).json({
        message: "Failed to fetch transaction",
        error: error.message
    });
    }
}

export const getTransactionById = async (req, res)=>{
    try{
        const userId = req.user._id;
        const {id} = req.params;
        const transaction = await Transaction.findOne({
            _id: id,
            user: userId,
            isGroupTransaction: false
        })

        if(!transaction) return res.status(404).json({message:"Transaction not found"});

        res.status(200).json(transaction)
    }catch(error){
            console.error("Get transaction error:", error);
            res.status(500).json({
                message: "Failed to fetch transaction",
                error: error.message
            });
        }
}


export const updateTransaction = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    let { title, category, amount, transactionType, date } = req.body;

    const transaction = await Transaction.findOne({
      _id: id,
      user: userId,
      isGroupTransaction: false
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found"
      });
    }

    if (title?.trim()) {
      transaction.title = title.trim();
    }

    if (category?.trim()) {
      const trimmedCategory = category.trim();
      const normalizedCategory =
        trimmedCategory.charAt(0).toUpperCase() +
        trimmedCategory.slice(1).toLowerCase();

      const user = await User.findById(userId);

      const exists = user.categories.some(
        (c) => c.toLowerCase() === normalizedCategory.toLowerCase()
      );

      if (!exists) {
        user.categories.push(normalizedCategory);
        await user.save();
      }

      transaction.category = normalizedCategory;
    }

    if (amount !== undefined) {
      const parsedAmount = Number(amount);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({
          message: "Amount must be a valid positive number"
        });
      }

      transaction.amount = parsedAmount;
    }

    if (transactionType) {
      if (!["expense", "income"].includes(transactionType)) {
        return res.status(400).json({
          message: "Invalid transaction type"
        });
      }

      transaction.transactionType = transactionType;
    }

    if (date) {
      transaction.date = new Date(date);
    }

    if (req.file) {
      if (transaction.image) {
        const oldPath = path.join(
        process.cwd(),
        transaction.image.replace(/^\/+/, "")
      );

        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      transaction.image = `/uploads/transactions/${req.file.filename}`;
    }

    await transaction.save();

    res.status(200).json({
      message: "Transaction updated successfully",
      transaction
    });
  } catch (error) {
    console.error("Update transaction error:", error);
    res.status(500).json({
      message: "Failed to update transaction",
      error: error.message
    });
  }
};

export const deleteTransaction = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const transaction = await Transaction.findOne({
      _id: id,
      user: userId,
      isGroupTransaction: false
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found"
      });
    }

    if (transaction.image) {
      const filePath = path.join(
          process.cwd(),
          transaction.image.replace(/^\/+/, "")
        );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await transaction.deleteOne();

    res.status(200).json({
      message: "Transaction deleted successfully"
    });
  } catch (error) {
    console.error("Delete transaction error:", error);
    res.status(500).json({
      message: "Failed to delete transaction",
      error: error.message
    });
  }
};
