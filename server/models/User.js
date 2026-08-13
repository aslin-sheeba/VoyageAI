import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true, index: true },
  name: String,
  email: String,
  photoURL: String,
}, {
  timestamps: true
});

export default mongoose.model("User", userSchema);
