import { useEffect, useRef, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/cict_logo.png'
import './styles/AdminNavbar.css'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: <path d="M5 20V10M12 20V4M19 20v-7" /> },
  { to: '/items', label: 'Item Listing', icon: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /> },
  { to: '/profile', label: 'Profile', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></> },
]

export default function AdminNavbar() {
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const closeBtn = useRef(null)

  const close = () => setOpen(false)

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

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 701px)')
    const onChange = (e) => {
      if (e.matches) setOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <header className="admin-nav">
      <div className="admin-nav-inner">
        <Link to="/dashboard" className="admin-nav-brand">
          <img src={logo} alt="" className="admin-nav-logo" />
          <span>CICT Lost &amp; Found</span>
        </Link>

        <button
          type="button"
          className="admin-nav-toggle"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="admin-menu"
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        {/* Dark overlay behind the drawer (mobile only) */}
        <div
          className={`admin-nav-backdrop${open ? ' is-open' : ''}`}
          onClick={close}
          aria-hidden="true"
        />

        <nav
          id="admin-menu"
          className={`admin-nav-menu${open ? ' is-open' : ''}`}
          aria-label="Admin"
        >
          <div className="admin-nav-drawer-head">
            <span>Menu</span>
            <button
              ref={closeBtn}
              type="button"
              className="admin-nav-close"
              aria-label="Close menu"
              onClick={close}
            >
              ×
            </button>
          </div>

          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `admin-nav-link${isActive ? ' is-active' : ''}`}
              onClick={close}
            >
              <svg className="admin-nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true" focusable="false">
                {link.icon}
              </svg>
              {link.label}
            </NavLink>
          ))}

          <span className="admin-nav-divider" aria-hidden="true" />
          <button type="button" className="admin-nav-logout" onClick={logout}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M16 8l4 4-4 4M20 12H9" />
            </svg>
            Log out
          </button>
        </nav>
      </div>
    </header>
  )
}