import { upsertStreamUser } from "../lib/stream.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken"

export async function signup(req,res) {
    const { fullName, email, password } = req.body;
    try {
        if(!fullName || !email || !password) {
            return res.status(400).json({message: "All fields are required"});
        }
        if(password.length < 6) {
            return res.status(400).json({message: "Password must be at least 6 characters"});
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already exists. Please use a different email." });
        }

        const randomPic = "https://avatar.iran.liara.run/public"

        //Create user
        const newUser = await User.create({
            email,
            fullName,
            password,
            profilePic: randomPic
        })

        try {
            await upsertStreamUser({
                id: newUser._id.toString(),
                name: newUser.fullName,
                image: newUser.profilePic || "",
            })
            console.log(`Stream user created: ${newUser.fullName}`);
        } catch (error) {
            console.error("Error creating Stream user",error);
        }

        const token = jwt.sign({userId: newUser._id}, process.env.JWT_SECRET, {
            expiresIn: "4d"
        })

        res.cookie("token", token, {
            maxAge: 1000 * 60 * 60 * 24 * 4,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict"
        })

        res.status(201).json({ success: true, user: newUser })

    } catch (error) {
        console.log("Error signing up",error)
        res.status(500).json({success: false, message: "Internal Server Error"});
    }
}

export async function login(req,res) {
    try{
        const { email, password } = req.body;

        if(!email || !password) {
            return res.status(400).json({message: "All fields are required"});
        }

        const user = await User.findOne({email});

        if(!user) {
            return res.status(401).json({message: "Invalid email or password"});
        }

        const isPasswordValid = await user.matchPassword(password);

        if(!isPasswordValid) {
            return res.status(401).json({message: "Invalid email or password"});
        }

        const token = jwt.sign({userId: user._id}, process.env.JWT_SECRET, {
            expiresIn: "4d"
        })

        res.cookie("token", token, {
            maxAge: 1000 * 60 * 60 * 24 * 4,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict"
        })

        res.status(200).json({ success: true, user })

    }catch(error) {
        console.log("Error logging in",error)
        res.status(500).json({success: false, message: "Internal Server Error"});
    }
}

export function logout(req,res) {
    res.clearCookie("token");
    res.status(200).json({success: true, message: "Logged out successfully"});
}

export async function onboard(req,res) {
    try {
        const userId = req.user._id;
        const { fullName, bio, nativeLang, learningLang, location } = req.body;

        if (!fullName || !bio || !nativeLang || !learningLang || !location) {
            return res.status(400).json({ 
                message: "All fields are required",
                missingFields: [
                    !fullName && "fullName", 
                    !bio && "bio", 
                    !nativeLang && "nativeLang", 
                    !learningLang && "learningLang", 
                    !location && "location"
                ].filter(Boolean),
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
              ...req.body,
              isOnboarded: true,
            },
            { new: true }
          );
      
        if (!updatedUser) return res.status(404).json({ message: "User not found" });

        try {
            await upsertStreamUser({
                id: updatedUser._id.toString(),
                name: updatedUser.fullName,
                image: updatedUser.profilePic || "",
            })
            console.log(`Stream user updated: ${updatedUser.fullName}`);
        } catch (error) {
            console.error("Error updating Stream user",error);
            res.status(500).json({success: false, message: "Error updating Stream user"});
        }
        res.status(200).json({ success: true, user: updatedUser });
    } catch (error) {
        console.error("Error onboarding user",error);
        res.status(500).json({success: false, message: "Internal Server Error"});
    }
}