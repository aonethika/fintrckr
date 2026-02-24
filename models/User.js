import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
{
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone_number: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },

  upiId: {
    type: String,
    trim: true
  },

  categories: {
    type: [String],
    default: ["Food", "Transport", "Entertainment", "Other"],
    set: (cats) => [...new Set(cats.map(c => c.trim()))]
  },

  monthlyBudgets: {
    type: Map,
    of: Number,
    default: {}
  },

  categoryBudgets: {
    type: Map,
    of: {
      type: Map,
      of: Number
    },
    default: {}
  }
},
{ timestamps: true }
);

export default mongoose.model("User", userSchema);