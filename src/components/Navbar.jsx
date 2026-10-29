import { Link } from 'react-router-dom'
import logo from '../assets/cict_logo.png'
import './styles//Navbar.css'

export default function Navbar() {
  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <img src={logo} alt="" className="navbar-logo" />
        <span>CICT Lost &amp; Found</span>
      </Link>
      <nav className="navbar-links">
        <Link to="/browse">Browse Items</Link>
        <a href="#how-claiming-works">How It Works</a>
      </nav>
    </header>
  )
}