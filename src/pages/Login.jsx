import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, user, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user && isAdmin) navigate('/dashboard', { replace: true })
  }, [user, isAdmin, loading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
    } catch {
      setError('Invalid email or password.')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 360, margin: '4rem auto', padding: '1rem' }}>
      <h1>LSC Login</h1>
      <input type="email" placeholder="Email" value={email}
        onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password}
        onChange={(e) => setPassword(e.target.value)} required />
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <button className="btn-primary" type="submit">Log in</button>
    </form>
  )
}