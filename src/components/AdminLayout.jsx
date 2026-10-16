import { Outlet } from 'react-router-dom'
import AdminNavbar from './AdminNavbar'

// Shared shell for every signed-in admin page: navbar on top, page below.
export default function AdminLayout() {
  return (
    <>
      <AdminNavbar />
      <Outlet />
    </>
  )
}