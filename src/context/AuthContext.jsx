import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { auth, db } from '../firebase'

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

const STAFF_ROLES = ['admin', 'officer']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null) // 'admin' | 'officer' | null
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      let nextRole = null
      if (u) {
        try {
          const snap = await get(ref(db, `users/${u.uid}`))
          const data = snap.exists() ? snap.val() : null
          // only active accounts with a known role get a role
          if (data && STAFF_ROLES.includes(data.role) && data.active !== false) {
            nextRole = data.role
          }
        } catch (err) {
          console.error('Role check failed:', err)
        }
      }
      setRole(nextRole)
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => signOut(auth)

  const isAdmin = role !== null // can use the admin pages (admin or officer)
  const canManageAccounts = role === 'admin' // can open Account List

  return (
    <AuthContext.Provider value={{ user, role, isAdmin, canManageAccounts, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}