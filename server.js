import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoute from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js'
import budgetRoutes from './routes/budgetRoutes.js'
import groupRoutes from './routes/groupRoutes.js'
import groupTransactionRoutes from './routes/groupTransactionRoutes.js'
import monthlySummaryRoutes from './routes/monthlySummaryRoutes.js'
import upiRoute from './routes/upiRoute.js'

dotenv.config()

const app = express()
const allowedOrigins = [
  "https://fintrckr.netlify.app",
  "http://localhost:5173"
];


app.get("/", (req, res) => {
  res.send("Fintrckr backend running ✅");
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); 
    }
  },
  credentials: true
}));


app.use(express.json())
app.use("/uploads", express.static("uploads"));
const PORT = process.env.PORT || 5000
connectDB()

app.use("/api/auth", authRoute);
app.use("/api/transactions", transactionRoutes)
app.use("/api/budget", budgetRoutes)
app.use("/api/group", groupRoutes)
app.use("/api/group-transactions", groupTransactionRoutes)
app.use("/api/monthly-summary", monthlySummaryRoutes)
app.use("/api/upi", upiRoute)

// app.get('/',(req, res)=>{
//     res.send("API running")
// })

app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
    
})