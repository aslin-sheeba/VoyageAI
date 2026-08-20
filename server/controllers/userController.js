import User from "../models/User.js";
import { connectDB } from "../db.js";

export const syncUser = async (req, res) => {
  try {
    await connectDB();
    const uid = req.user.uid;
    const { name, email, photoURL } = req.body;

    const user = await User.findOneAndUpdate(
      { uid },
      { name, email, photoURL },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: "User synchronized successfully",
      user,
    });
  } catch (error) {
    console.error("Sync user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sync user details",
      error: error.message,
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    await connectDB();
    const uid = req.user.uid;
    const user = await User.findOne({ uid });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve user profile",
      error: error.message,
    });
  }
};
