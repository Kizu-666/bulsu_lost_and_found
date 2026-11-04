import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './styles/Login.css'
import logo from '../assets/cict_logo.png'
import emailIcon from '../assets/email.svg'
import passwordIcon from '../assets/password.svg'
import hidePassIcon from '../assets/hide_pass.svg'
import showPassIcon from '../assets/show_pass.svg'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase'
import Modal from '../components/Modal'
import FormError from '../components/FormError'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function resetErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes, then try again.'
    case 'auth/network-request-failed':
      return 'Cannot reach the server. Check your internet connection.'
    default:
      return 'Could not send the link. Please try again.'
  }
}

function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Incorrect email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes, then try again.'
    case 'auth/network-request-failed':
      return 'Cannot reach the server. Check your internet connection.'
    default:
      return 'Could not sign in. Please try again.'
  }
}

export default function Login() {
  const { login, logout, user, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [invalid, setInvalid] = useState({ email: false, password: false })
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState([])
  const [resetInvalid, setResetInvalid] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const passwordRef = useRef(null)

  useEffect(() => {
    if (loading || !user) return
    if (isAdmin) {
      navigate('/dashboard', { replace: true })
    } else {
      setError('This account does not have officer access.')
      logout()
    }
  }, [user, isAdmin, loading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInvalid({ email: false, password: false })
    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(friendlyError(err.code))
      passwordRef.current?.focus()
      passwordRef.current?.select()
    } finally {
      setSubmitting(false)
    }
  }

  const openReset = () => {
    setResetEmail(email.trim()) // reuse what they already typed
    setResetError([])
    setResetInvalid(false)
    setResetSent(false)
    setShowReset(true)
  }

  const closeReset = () => {
    if (!resetBusy) setShowReset(false)
  }

  const handleReset = async (e) => {
    e.preventDefault()
    const value = resetEmail.trim()

    if (!value) {
      setResetInvalid(true)
      setResetError(['Enter your email address.'])
      return
    }
    if (!EMAIL.test(value)) {
      setResetInvalid(true)
      setResetError(['Enter a valid email address.'])
      return
    }

    setResetBusy(true)
    setResetError([])
    setResetInvalid(false)
    try {
      await sendPasswordResetEmail(auth, value)
      setResetSent(true)
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        // Same message as a real send, so this form never reveals which emails have accounts
        setResetSent(true)
      } else {
        console.error('Reset email failed:', err)
        if (err.code === 'auth/invalid-email') setResetInvalid(true)
        setResetError([resetErrorMessage(err.code)])
      }
    } finally {
      setResetBusy(false)
    }
  }
  return (
    <main className="login" id="main">
      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1>Sign in</h1>
          <p className="login-sub">For CICT LSC officers only.</p>

          <div className="login-field">
            <label htmlFor="email">Email <span className="login-req">*</span></label>
            <div className="login-input">
              <span
                className="login-input-icon"
                style={{ '--icon': `url("${emailIcon}")` }}
                aria-hidden="true"
              />
              <input
                id="email" type="email" autoComplete="email"
                aria-invalid={invalid.email ? 'true' : undefined}
                aria-describedby={error ? 'login-error' : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (invalid.email) setInvalid((v) => ({ ...v, email: false }))
                }}
                required
                placeholder="cict@example.com"
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="password">Password <span className="login-req">*</span></label>
            <div className="login-input">
              <span
                className="login-input-icon"
                style={{ '--icon': `url("${passwordIcon}")` }}
                aria-hidden="true"
              />
              <input
                id="password" type={showPassword ? 'text' : 'password'}
                ref={passwordRef}
                autoComplete="current-password"
                aria-invalid={invalid.password ? 'true' : undefined}
                aria-describedby={error ? 'login-error' : undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (invalid.password) setInvalid((v) => ({ ...v, password: false }))
                }}
                required
                placeholder="********"
              />
              <button
                type="button" className="login-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <span
                  className="login-toggle-icon"
                  style={{ '--icon': `url("${showPassword ? showPassIcon : hidePassIcon}")` }}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>  
          
          <div className="login-forgot-row">
            <button type="button" className="login-forgot" onClick={openReset}>
              Forgot password?
            </button>
          </div>

          {error && (
            <p className="login-error" id="login-error" role="alert">
              <svg className="login-error-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path d="M12 3 2 21h20L12 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M12 10v5M12 17.8v.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>{error}</span>
            </p>
          )}

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : (<>Sign in <span aria-hidden="true">→</span></>)}
          </button>

          <p className="login-back"><Link to="/">Back to home</Link></p>
        </form>
      </section>

      <aside className="login-aside">
        <Link to="/" className="login-brand">
          <span className="login-logo-badge">
            <img src={logo} alt="" className="login-logo" />
          </span>
          <span className="login-brand-name">CICT Lost &amp; Found</span>
        </Link>

        <div className="login-aside-body">
          <p className="login-pitch">Keep the lost and found list up to date.</p>
          <p className="login-pitch-sub">
            Post items, track their status and record claims at the CICT LSC.
          </p>
        </div>

        <p className="login-aside-foot">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="9.5" r="2.5" fill="currentColor" />
          </svg>
          Bulacan State University, Main Campus
        </p>
      </aside>
      <Modal open={showReset} onClose={closeReset}>
        {resetSent ? (
          <div className="login-reset">
            <h2>Check your email</h2>
            <p className="login-reset-text">
              If an account exists for <strong>{resetEmail.trim()}</strong>, we sent a link to set a new
              password. It can take a few minutes, and it may land in your spam folder.
            </p>
            <div className="login-reset-actions">
              <button type="button" className="btn-primary" onClick={() => setShowReset(false)}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="login-reset" onSubmit={handleReset} noValidate>
            <h2>Forgot password?</h2>
            <p className="login-reset-text">
              Enter your email and we will send you a link to set a new password.
            </p>

            <div className="login-field">
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => {
                  setResetEmail(e.target.value)
                  setResetInvalid(false)
                }}
                aria-invalid={resetInvalid ? 'true' : undefined}
                aria-describedby={resetInvalid ? 'reset-error' : undefined}
                placeholder="cict@example.com"
                required
              />
            </div>

            <FormError message={resetError} id="reset-error" />

            <div className="login-reset-actions">
              <button type="button" className="btn-outline" onClick={closeReset} disabled={resetBusy}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={resetBusy}>
                {resetBusy ? 'Sending…' : 'Send link'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  )
}