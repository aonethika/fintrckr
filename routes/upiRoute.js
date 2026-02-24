import express from "express";
import { authMiddleware } from "../middleware/verifyToken.js";
import { setUpi, updateUpi } from "../controllers/upiConntroller.js";


const router = express.Router();

router.use(authMiddleware);

router.post("/", setUpi);
router.put("/",updateUpi)


export default router;