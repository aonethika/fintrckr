import mongoose from "mongoose";

const splitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ["unpaid", "requested", "paid"],
      default: "unpaid"
    }
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      required: true,
      trim: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },
    
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    memberName: {
      type: String, // optional, for display
      default: null
    },

    transactionType: {
      type: String,
      enum: ["expense", "income"],
      default: "expense",
      required: true,
      index: true
    },

    image: {
      type: String,
      default: null
    },

    date: {
      type: Date,
      default: Date.now,
      index: true
    },

    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null
    },

    isGroupTransaction: {
      type: Boolean,
      default: false
    },

    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    splits: [splitSchema]
  },
  {
    timestamps: true
  }
);

transactionSchema.index({ user: 1, date: 1 });

export default mongoose.model("Transaction", transactionSchema);