import express from "express";
import { authMiddleware } from "../middleware/verifyToken.js";
import upload from "../middleware/upload.js";
import {
  createPersonalTransaction,
  deleteTransaction,
  getAllPersonalTransactions,
  getTransactionById,
  updateTransaction
} from "../controllers/transcationController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", upload.single("image"), createPersonalTransaction);

router.get("/", getAllPersonalTransactions);

router.get("/:id", getTransactionById);

router.put("/:id", upload.single("image"), updateTransaction);

router.delete("/:id", deleteTransaction);

export default router;
