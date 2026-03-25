import { Link, useLocation } from 'react-router-dom'

export default function SiteNav() {
  const { pathname } = useLocation()

  return (
    <nav className="site-nav">
      <Link to="/" className="site-nav__logo">
        <img src={import.meta.env.BASE_URL + 'logo.png'} alt="Choan" className="site-nav__logo-img" />
        Choan
      </Link>
      <div className="site-nav__links">
        <Link to="/features" className={`site-nav__link${pathname === '/features' ? ' active' : ''}`}>Features</Link>
        <Link to="/app" className="site-nav__cta">Do Sketch</Link>
      </div>
    </nav>
  )
}
