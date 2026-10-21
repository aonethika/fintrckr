import mongoose from "mongoose";

export const connectDB = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required. See backend/.env.example.');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('Finsight database connected');
};
