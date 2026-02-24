import User from "../models/User.js";

export const setUpi = async (req, res) => {
  try {
    const userId = req.user._id;
    const { upi } = req.body;

    if (!upi || upi.trim() === "") {
      return res.status(400).json({ message: "Not valid upi" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.upiId = upi.trim();
    await user.save();

    res.status(200).json({
      message: "UPI updated successfully",
      upiId: user.upiId
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};


export const updateUpi = async (req, res) => {
  try {
    const userId = req.user._id;
    const { upi } = req.body;

    if (!upi || upi.trim() === "") {
      return res.status(400).json({ message: "Invalid UPI ID" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { upiId: upi.trim() },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "UPI updated successfully",
      user
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update UPI",
      error: error.message
    });
  }
};