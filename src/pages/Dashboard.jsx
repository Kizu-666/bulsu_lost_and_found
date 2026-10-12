import { useAuth } from '../context/AuthContext'
export default function Dashboard() {
  const { user, logout } = useAuth()
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      <p>Logged in as {user?.email}</p>
      <button className="btn-primary" onClick={logout}>Log out</button>
    </div>
  )
}