import { auth } from "../firebase";

export async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) {
    return {
      "Content-Type": "application/json"
    };
  }
  try {
    const token = await user.getIdToken(true); // Force refresh to prevent expiration issues
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };
  } catch (err) {
    console.error("Error retrieving authentication token:", err);
    return {
      "Content-Type": "application/json"
    };
  }
}
