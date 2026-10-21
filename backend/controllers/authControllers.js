import User from "../models/User.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

/**
 * Register new user and return JWT token
 */
export const signup = async (req, res) => {
    try {
        const { name, email, phone_number, password, upiId } = req.body;

        if (!name || !email || !phone_number || !password)
            return res.status(400).json({ message: "All fields are required" });

        // Normalize email to prevent duplicate accounts with different casing
        const emailNormalized = email.toLowerCase();

        const existingUser = await User.findOne({ email: emailNormalized });
        if (existingUser)
            return res.status(409).json({ message: "User already exists" });

        // Secure password hashing
        const hashedPassword = await argon2.hash(password);

        const newUser = await User.create({
            name,
            email: emailNormalized,
            phone_number,
            password: hashedPassword,
            upiId,
        });

        // Issue authentication token
        const token = jwt.sign(
            { id: newUser._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.status(201).json({
            message: "User created successfully",
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                phone_number: newUser.phone_number,
                upiId: newUser.upiId,
            },
        });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({
            message: "Signup failed",
            error: err.message,
        });
    }
};

/**
 * Authenticate user credentials and return JWT token
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ message: "All fields are required" });

        const emailNormalized = email.toLowerCase();

        // Password explicitly selected (excluded by default in schema)
        const user = await User.findOne({ email: emailNormalized }).select("+password");
        if (!user)
            return res.status(400).json({ message: "Invalid credentials" });

        const isValid = await argon2.verify(user.password, password);
        if (!isValid)
            return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone_number: user.phone_number,
                upiId: user.upiId,
            },
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({
            message: "Login failed",
            error: err.message,
        });
    }
};