import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/* Only admins can open pages wrapped in this. Officers are sent back to the dashboard. */
export default function RequireAccountAdmin({ children }) {
  const { canManageAccounts, loading } = useAuth()

  if (loading) return null // wait until the role is known, so we don't redirect too early

  return canManageAccounts ? children : <Navigate to="/dashboard" replace />
}
