import { useEffect, useRef } from 'react'
import './styles/ResultDialog.css'

export default function ResultDialog({ result, onPrimary, onSecondary }) {
  const primaryRef = useRef(null)

  useEffect(() => {
    if (result) primaryRef.current?.focus()
  }, [result])

  useEffect(() => {
    if (!result) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onPrimary()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [result, onPrimary])

  if (!result) return null

  return (
    <div className="result-backdrop">
      <div
        className="result"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="result-title"
        aria-describedby="result-text"
      >
        <div className={`result-icon ${result.ok ? 'is-ok' : 'is-error'}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
               strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {result.ok
              ? <path d="M5 12.5l4.5 4.5L19 7.5" />
              : <path d="M12 7v6M12 17h.01" />}
          </svg>
        </div>

        <h2 id="result-title">
          {result.ok ? 'Item posted' : 'Could not post the item'}
        </h2>

        <p id="result-text">
          {result.ok
            ? <>&ldquo;{result.name}&rdquo; was added as <strong>{result.itemId}</strong>.</>
            : result.message}
        </p>

        <div className="result-actions">
          <button type="button" className="btn-outline" onClick={onSecondary}>
            {result.ok ? 'Post another' : 'Cancel'}
          </button>
          <button type="button" className="btn-primary" ref={primaryRef} onClick={onPrimary}>
            {result.ok ? 'Done' : 'Try again'}
          </button>
        </div>
      </div>
    </div>
  )
}