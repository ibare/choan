import { Link } from 'react-router-dom'
import SiteNav from './SiteNav'
import { track } from '../utils/analytics'

export default function LandingPage() {
  return (
    <div className="site" data-theme="dark">
      <SiteNav />

      {/* Hero */}
      <section className="hero">
        <p className="hero__badge">Design → Prompt</p>
        <h1 className="hero__title">
          Sketch UI.<br />
          <span className="gradient-text">Export to LLM.</span>
        </h1>
        <p className="hero__sub">
          Choan converts your UI sketches into structured specs
          that LLMs actually understand. No more verbose descriptions
          or ambiguous screenshots.
        </p>
        <div className="hero__actions">
          <Link to="/app" className="btn-primary" onClick={() => track('landing-cta-click')}>Get started for free</Link>
          <Link to="/features" className="btn-ghost">Learn More</Link>
        </div>
        <img
          src={import.meta.env.BASE_URL + 'landing.png'}
          alt="Choan editor screenshot"
          className="hero__image"
        />
      </section>

      {/* Value Props */}
      <section className="props">
        <div className="props__grid">
          <div className="prop-card">
            <div className="prop-card__icon">SDF</div>
            <h3 className="prop-card__title">3D SDF Renderer</h3>
            <p className="prop-card__desc">
              Custom WebGL2 ray marching engine with toon shading,
              edge detection, and mathematically perfect outlines.
            </p>
          </div>
          <div className="prop-card">
            <div className="prop-card__icon">UI</div>
            <h3 className="prop-card__title">16 Component Skins</h3>
            <p className="prop-card__desc">
              Buttons, switches, sliders, avatars, tables — pre-built
              skins that render as real UI components on the canvas.
            </p>
          </div>
          <div className="prop-card">
            <div className="prop-card__icon">MD</div>
            <h3 className="prop-card__title">LLM-Ready Export</h3>
            <p className="prop-card__desc">
              One-click export to structured Markdown that Claude, GPT,
              and other LLMs can parse into working code.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <p>© 2026 DAY 1 COMPANY. All rights reserved.</p>
      </footer>
    </div>
  )
}
