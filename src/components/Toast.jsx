import { useEffect } from 'react'

export default function Toast({ notice, onClose }) {
  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [notice, onClose])

  if (!notice) return null
  return (
    <div className="il-toast" role="status" aria-live="polite">
      <span>{notice}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss message">×</button>
    </div>
  )
}