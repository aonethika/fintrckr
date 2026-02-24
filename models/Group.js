import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      "text",
      "split",
      "paid",
      "system",
      "payment_requested",
      "payment_confirmed",
      "split_settled",
    "payment_confirmed_member",
    "group_fully_settled"
    ],
    required: true
  },

  text: { type: String },

  title: { type: String },

  amount: { type: Number },

  expense: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction"
  },

  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  creator:{
    type : mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  payer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  splits: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      name: String,
      amount: Number,
      status: {
        type: String,
        enum: ["unpaid", "requested", "paid"]
      }
    }
  ],

  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});


const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      }
    ],
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    messages: [messageSchema],
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Group", groupSchema);
