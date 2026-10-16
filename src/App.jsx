import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import Landing from './pages/Landing'
import Browse from './pages/Browse'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ItemListing from './pages/ItemListing'
import Profile from './pages/Profile'
import PostItem from './pages/PostItem'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/browse" element={<Browse />} />
      <Route path="/lsc-login" element={<Login />} />

      {/* Signed-in admin pages share the admin navbar */}
      <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/items" element={<ItemListing />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="/post-item" element={
        <ProtectedRoute><PostItem /></ProtectedRoute>
      } />
    </Routes>
  )
}