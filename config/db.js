import mongoose from "mongoose";

export const connectDB = ()=>{
    try{
        mongoose.connect(process.env.MONGO_URI);
        console.log("Database connected");
        
    }
    catch(err){
        console.log("Database connection failed", err); 
    }
   
}