import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authMiddleware = async ( req, res, next)=>{
    try{
        const authHeader = req.headers.authorization;
    if(!authHeader)
        return res.status(401).json({ message: "No token provided" })

    const token =  authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

     req.user = await User.findById(decoded.id).select("-password")
     next()
    }catch(err){
        res.status(401).json({ message: "Unauthorized", error: err.message });
    }
    
}