import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './styles/Modal.css'

export default function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined

    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // nav sa taas: hindi clickable/focusable habang bukas ang popup
    const nav = document.querySelector('header, .navbar')
    nav?.setAttribute('inert', '')
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      nav?.removeAttribute('inert')
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}