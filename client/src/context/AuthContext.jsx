import { createContext, useContext, useEffect, useState } from "react"
import { auth } from "../firebase"
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"
import { syncUser } from "../api/userService"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const logout = async () => {
    await signOut(auth)
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u)
        try {
          // Sync profile info with MongoDB
          await syncUser({
            name: u.displayName,
            email: u.email,
            photoURL: u.photoURL
          });
        } catch (err) {
          console.error("Failed to sync user on auth state change:", err);
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
