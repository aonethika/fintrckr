import express from "express";
import { authMiddleware } from "../middleware/verifyToken.js";
import {
  setMonthlyBudget,
  getMonthlyBudget,
  deleteMonthlyBudget,
  setCategoryBudget,
  deleteCategoryBudget
} from "../controllers/budgetController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/monthly", setMonthlyBudget);
router.get("/monthly", getMonthlyBudget);
router.delete("/monthly/:month", deleteMonthlyBudget);

router.post("/category", setCategoryBudget);
router.delete("/category/:month/:category", deleteCategoryBudget);

export default router;