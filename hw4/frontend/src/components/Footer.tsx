import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <strong>Campus Customs</strong>
          <p>Officially licensed Yale apparel, printed and picked for the Bulldog community.</p>
        </div>
        <div>
          <strong>Visit</strong>
          <p>57 Broadway, New Haven, CT 06511</p>
        </div>
        <div className="footer-links">
          <Link to="/products">Shop all</Link>
          <Link to="/about">About Us</Link>
          <Link to="/create-account">Create account</Link>
        </div>
      </div>
      <p className="footer-note">© {new Date().getFullYear()} Campus Customs · Homework 4 demo store</p>
    </footer>
  )
}
