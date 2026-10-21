import Group from "../models/Group.js";
import User from "../models/User.js";

/**
 * Create a new group.
 * Admin is automatically included as a member.
 */
export const createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const admin = req.user._id;

    if (!name || !members || members.length < 1 || !admin) {
      return res.status(400).json({ message: "Cannot create group. Invalid data." });
    }

    // Resolve members using email or phone number
    const foundMembers = await User.find({
      $or: [
        { email: { $in: members } },
        { phone_number: { $in: members } }
      ]
    }).select("_id");

    if (foundMembers.length !== members.length) {
      return res.status(404).json({ message: "One or more members do not exist" });
    }

    const memberIds = foundMembers.map(u => u._id.toString());

    // Ensure admin is always part of the group
    const allMembers = memberIds.includes(admin.toString())
      ? memberIds
      : [...memberIds, admin];

    const adminUser = await User.findById(admin).select("name");

    const group = await Group.create({
      name,
      members: allMembers,
      admin,
      messages: [
        { type: "system", text: `${adminUser.name} created a new group "${name}".` }
      ],
      status: "inactive"
    });

    res.status(201).json({
      message: "Group created successfully",
      group
    });

  } catch (error) {
    console.error("Create group error:", error);
    res.status(500).json({
      message: "Failed to create group",
      error: error.message
    });
  }
};


/**
 * Fetch all groups where the current user is a member.
 */
export const getAllGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await Group.find({ members: userId })
      .populate("members", "name email")
      .populate("admin", "name email")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      count: groups.length,
      groups
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch groups",
      error: error.message
    });
  }
};


/**
 * Fetch single group with fully populated chat and expense references.
 * Access allowed only if user is a group member.
 */
export const getGroupById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const group = await Group.findOne({
      _id: id,
      members: userId
    })
      .populate("members", "name email upiId")
      .populate("admin", "name email")

      // message-level relations
      .populate("messages.sender", "name email")
      .populate("messages.creator", "name email")
      .populate("messages.payer", "name email")

      // nested expense inside messages
      .populate({
        path: "messages.expense",
        populate: [
          { path: "creator", select: "name email" },
          { path: "splits.user", select: "name email" }
        ]
      });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json(group);

  } catch (error) {
    console.error("GET GROUP ERROR:", error);
    res.status(500).json({
      message: "Failed to fetch group",
      error: error.message
    });
  }
};


/**
 * Add members to group (admin only).
 */
export const addMembersToGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId, newMembers } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!group.admin.equals(userId))
      return res.status(403).json({ message: "Only admin can add members" });

    const users = await User.find({
      $or: [
        { email: { $in: newMembers } },
        { phone_number: { $in: newMembers } }
      ]
    }).select("_id");

    if (users.length !== newMembers.length)
      return res.status(404).json({ message: "One or more users do not exist" });

    // Prevent duplicate members
    users.forEach(u => {
      if (!group.members.includes(u._id)) {
        group.members.push(u._id);
      }
    });

    await group.save();
    res.status(200).json({ message: "Members added", members: group.members });
  } catch (error) {
    res.status(500).json({ message: "Failed to add members", error: error.message });
  }
};


/**
 * Remove members from group (admin only).
 */
export const removeMembersFromGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId, removeMembers } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!group.admin.equals(userId))
      return res.status(403).json({ message: "Only admin can remove members" });

    group.members = group.members.filter(
      memberId => !removeMembers.includes(memberId.toString())
    );

    await group.save();
    res.status(200).json({ message: "Members removed", members: group.members });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove members", error: error.message });
  }
};


/**
 * Delete group permanently (admin only).
 */
export const deleteGroup = async (req, res) => {
  try {
    const userId = req.user._id;
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!group.admin.equals(userId)) {
      return res.status(403).json({ message: "Only admin can delete the group" });
    }

    await group.deleteOne();
    res.status(200).json({ message: "Group deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: "Failed to delete group", error: error.message });
  }
};


/**
 * Add text message to group chat.
 */
export const addGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { message } = req.body;

    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Accept plain string or structured message object
    const text =
      typeof message === "string"
        ? message
        : message?.text;

    if (!text?.trim()) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const group = await Group.findById(groupId);
    if (!group)
      return res.status(404).json({ message: "Group not found" });

    const newMessage = {
      text,
      sender: req.user._id,
      type: "text",
      createdAt: new Date(),
    };

    group.messages.push(newMessage);
    await group.save();

    const populatedGroup = await Group.findById(groupId)
      .populate("members", "name email")
      .populate("admin", "name email")
      .populate("messages.sender", "name email");

    res.status(201).json({ messages: populatedGroup.messages });

  } catch (err) {
    console.error("ADD GROUP MESSAGE ERROR:", err);
    res.status(500).json({
      message: "Failed to add message",
      error: err.message
    });
  }
};