import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'

export default function useItems() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = onValue(
      ref(db, 'items'),
      (snapshot) => {
        const data = snapshot.val() || {}
        setItems(Object.entries(data).map(([key, value]) => ({ key, ...value })))
        setLoading(false)
      },
      (err) => {
        console.error(err)
        setError('Could not load items.')
        setLoading(false)
      }
    )
    return unsubscribe
  }, [])

  return { items, loading, error }
}