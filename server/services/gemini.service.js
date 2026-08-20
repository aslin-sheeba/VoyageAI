import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function askGemini(prompt) {
  try {
    // 👇 CHANGED: Using the reliable alias from your list
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash" 
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error("❌ Gemini API Detailed Error:", err);
    return "AI Error: Check server logs.";
  }
}