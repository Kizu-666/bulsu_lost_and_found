import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'

export default function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsub = onValue(
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
    return unsub
  }, [])

  return { accounts, loading, error }
}