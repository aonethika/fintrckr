import express from "express";
import { authMiddleware } from "../middleware/verifyToken.js";
import {
  createGroup,
  getAllGroups,
  getGroupById,
  addMembersToGroup,
  removeMembersFromGroup,
  deleteGroup,
  addGroupMessage
} from "../controllers/groupController.js";

const router = express.Router();
router.use(authMiddleware);

router.post("/", createGroup);
router.get("/", getAllGroups);
router.get("/:id", getGroupById);
router.put("/add-members", addMembersToGroup);
router.post("/:groupId/messages",addGroupMessage)
router.put("/remove-members", removeMembersFromGroup);
router.delete("/:groupId", deleteGroup);

export default router;
