import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Initialize Firebase Admin SDK using modular exports
if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "voyageai-3ac6a",
  });
}

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No authorization token provided",
        errorCode: "TOKEN_MISSING",
      });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (verifyError) {
      console.error("Token verification failed:", verifyError.message);
      
      let errorCode = "TOKEN_INVALID";
      let message = "Unauthorized access - Invalid token";
      
      if (verifyError.code === "auth/id-token-expired") {
        errorCode = "TOKEN_EXPIRED";
        message = "Unauthorized access - Token expired";
      }

      return res.status(401).json({
        success: false,
        message,
        errorCode,
      });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication",
      errorCode: "SERVER_AUTH_ERROR",
    });
  }
};
