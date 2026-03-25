import { Link } from 'react-router-dom'
import { GithubLogo } from '@phosphor-icons/react'

export default function SiteNav() {
  return (
    <nav className="site-nav">
      <Link to="/" className="site-nav__logo">
        <img src={import.meta.env.BASE_URL + 'logo.png'} alt="Choan" className="site-nav__logo-img" />
        Choan
      </Link>
      <div className="site-nav__links">
        <Link to="/app" className="site-nav__cta">Do Sketch</Link>
        <a href="https://github.com/ibare/choan" target="_blank" rel="noopener noreferrer" className="site-nav__link">
          <GithubLogo size={20} />
        </a>
      </div>
    </nav>
  )
}
