import express from "express";
import { 
  createGroupSplit, 
  markSplitAsPaid, 
  confirmSplitPayment, 
  getGroupSplitSummary
} from "../controllers/groupTransactionController.js";
import { authMiddleware } from "../middleware/verifyToken.js";


const router = express.Router();

router.use(authMiddleware)
router.post("/:groupId/split", createGroupSplit);     
router.post("/:expenseId/mark-paid", markSplitAsPaid); 
router.put("/confirm/:expenseId", confirmSplitPayment); 
router.get("/summary", getGroupSplitSummary);


export default router;




