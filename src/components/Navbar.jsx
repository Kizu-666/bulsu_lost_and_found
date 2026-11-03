import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import logo from '../assets/cict_logo.png'
import './styles/Navbar.css'

const searchIcon = (
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </>
)

const infoIcon = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </>
)

function Icon({ children }) {
  return (
    <svg className="navbar-icon" viewBox="0 0 24 24" width="18" height="18" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const closeBtn = useRef(null)
  const { pathname, hash } = useLocation()

  const close = () => setOpen(false)

  // Lock scroll, close on Escape, focus the close button while the drawer is open
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  // Close the drawer if the screen grows past the mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 701px)')
    const onChange = (e) => {
      if (e.matches) setOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // React Router doesn't scroll to #hash on its own
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }, [pathname, hash])

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <img src={logo} alt="" className="navbar-logo" />
        <span>CICT Lost &amp; Found</span>
      </Link>

      <button
        type="button"
        className="navbar-toggle"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="navbar-menu"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <div
        className={`navbar-backdrop${open ? ' is-open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      <nav
        id="navbar-menu"
        className={`navbar-links${open ? ' is-open' : ''}`}
        aria-label="Main"
      >
        <div className="navbar-drawer-head">
          <span>Menu</span>
          <button
            ref={closeBtn}
            type="button"
            className="navbar-close"
            aria-label="Close menu"
            onClick={close}
          >
            ×
          </button>
        </div>

        <NavLink
          to="/browse"
          className={({ isActive }) => (isActive ? 'is-active' : undefined)}
          onClick={close}
        >
          <Icon>{searchIcon}</Icon>
          Browse Items
        </NavLink>
        <Link to="/#how-claiming-works" onClick={close}>
          <Icon>{infoIcon}</Icon>
          How It Works
        </Link>
      </nav>
    </header>
  )
}