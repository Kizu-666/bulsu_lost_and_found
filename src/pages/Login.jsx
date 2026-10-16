import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './styles/Login.css'
import logo from '../assets/cict_logo.png'
import emailIcon from '../assets/email.svg'
import passwordIcon from '../assets/password.svg'
import hidePassIcon from '../assets/hide_pass.svg'
import showPassIcon from '../assets/show_pass.svg'

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

  useEffect(() => {
    if (loading || !user) return
    if (isAdmin) {
      navigate('/dashboard', { replace: true })
    } else {
      setError('This account does not have officer access.')
      logout()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, loading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login">
      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1>Sign in</h1>
          <p className="login-sub">For CICT LSC officers only.</p>

          <div className="login-field">
            <label htmlFor="email">Email</label>
            <div className="login-input">
              <span
                className="login-input-icon"
                style={{ '--icon': `url("${emailIcon}")` }}
                aria-hidden="true"
              />
              <input
                id="email" type="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="cict@example.com"
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <div className="login-input">
              <span
                className="login-input-icon"
                style={{ '--icon': `url("${passwordIcon}")` }}
                aria-hidden="true"
              />
              <input
                id="password" type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} required
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

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="btn-primary login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="login-back"><Link to="/">Back to home</Link></p>
        </form>
      </section>

      <aside className="login-aside">
        <Link to="/" className="login-brand">
          <img src={logo} alt="" className="login-logo" />
          <span>CICT Lost &amp; Found</span>
        </Link>

        <div className="login-aside-body">
          <p className="login-pitch">Keep the lost and found list up to date.</p>
          <p className="login-pitch-sub">
            Post items, track their status, and record claims at the CICT LSC.
          </p>
        </div>

        <p className="login-aside-foot">Bulacan State University, Main Campus</p>
      </aside>
    </main>
  )
}