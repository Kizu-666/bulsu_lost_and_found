import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { auth, db } from '../firebase'

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      let admin = false
      if (u) {
        try {
          const snap = await get(ref(db, `users/${u.uid}`))
          admin = snap.exists() && snap.val().role === 'admin'
        } catch (err) {
          console.error('Role check failed:', err)
        }
      }
      setIsAdmin(admin)
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}