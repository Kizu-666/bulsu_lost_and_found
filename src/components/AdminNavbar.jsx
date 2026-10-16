import { useEffect, useRef, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/cict_logo.png'
import './styles/AdminNavbar.css'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/items', label: 'Item Listing' },
  { to: '/profile', label: 'Profile' },
]

export default function AdminNavbar() {
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const closeBtn = useRef(null)

  const close = () => setOpen(false)

  // While the drawer is open: Escape closes it, the page behind can't scroll,
  // and keyboard focus moves into the drawer
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

  // If the window grows past the mobile breakpoint, close the drawer
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
              {link.label}
            </NavLink>
          ))}

          <button type="button" className="btn-outline admin-nav-logout" onClick={logout}>
            Log out
          </button>
        </nav>
      </div>
    </header>
  )
}