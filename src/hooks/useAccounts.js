import { useEffect, useState } from 'react'
import { ref, get, onValue } from 'firebase/database'
import { auth, db } from '../firebase'

export default function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let unsub = null
    let cancelled = false

    async function start() {
      // Only admins can read the whole /users list; officers can read just their own record
      let canReadAll = false
      const uid = auth.currentUser?.uid
      if (uid) {
        try {
          const snap = await get(ref(db, `users/${uid}/role`))
          canReadAll = snap.val() === 'admin'
        } catch (err) {
          console.error(err)
        }
      }
      if (cancelled) return

      if (!canReadAll) {
        setAccounts([])
        setLoading(false)
        return
      }

      unsub = onValue(
        ref(db, 'users'),
        (snap) => {
          const val = snap.val() || {}
          setAccounts(Object.entries(val).map(([uid, v]) => ({ uid, ...v })))
          setLoading(false)
        },
        (err) => {
          console.error(err)
          setError('Could not load the accounts. Check your connection and permissions.')
          setLoading(false)
        }
      )
    }

    start()
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  return { accounts, loading, error }
}