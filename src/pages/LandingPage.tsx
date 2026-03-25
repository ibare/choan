import { Link } from 'react-router-dom'
import SiteNav from './SiteNav'
import { track } from '../utils/analytics'

interface FeatureProps {
  tag: string
  title: string
  desc: string
  video?: string
  details: string[]
}

function Feature({ tag, title, desc, video, details }: FeatureProps) {
  return (
    <div className="feature">
      <span className="feature__tag">{tag}</span>
      <h2 className="feature__title">{title}</h2>
      <p className="feature__desc">{desc}</p>
      {video && (
        <video className="feature__video" autoPlay muted loop playsInline>
          <source src={video} type="video/webm" />
        </video>
      )}
      <ul className="feature__list">
        {details.map((d, i) => <li key={i}>{d}</li>)}
      </ul>
    </div>
  )
}

const FEATURES: FeatureProps[] = [
  {
    tag: 'Rendering',
    title: '3D SDF Ray Marching',
    desc: 'A fully custom WebGL2 renderer — not Canvas 2D, not Three.js. Every pixel is ray-marched through signed distance fields for mathematically perfect edges at any resolution.',
    video: import.meta.env.BASE_URL + '3d-sdf-ray-marching.webm',
    details: [
      '2-pass pipeline: Geometry (MRT) → Edge Detection (Roberts Cross)',
      'Toon shading with configurable warm tone and side darkening',
      'Rim glow emission on hover — 3D normal × view direction dot product',
      'Per-element Z-lift and opacity transitions via UBO',
      'Adaptive supersampling for HiDPI displays',
    ],
  },
  {
    tag: 'Components',
    title: '16 UI Component Skins',
    desc: 'Drag a rectangle and turn it into a real UI component. Buttons, switches, sliders, avatars, tables — each with interactive state and playable image.',
    video: import.meta.env.BASE_URL + '16-ui-component-skins.webm',
    details: [
      'Switch, Checkbox, Radio, Button, Slider, Text Input',
      'Progress, Badge, Star Rating, Avatar, Search, Dropdown',
      'Text, Table Skeleton, Image Placeholder, Icon',
      'Canvas 2D rendering → texture atlas → GPU',
      'Per-skin componentState: { on, checked, label, value, ... }',
    ],
  },
  {
    tag: 'Layout',
    title: 'Auto Layout Engine',
    desc: 'Flexbox-inspired container layout. Drop elements into containers and they arrange themselves — row, column, or grid. Nest containers for complex multi-level layouts.',
    video: import.meta.env.BASE_URL + 'auto-layout-engine.webm',
    details: [
      'Layout directions: Free, Row, Column, Grid',
      'Gap, Padding, Column count controls',
      'Child sizing: Equal, Fill, Fixed Ratio, Fixed Pixel',
      'Auto-reparent on drag into container',
      'Device frames: Browser (16:10) and Mobile (iPhone) with safe insets',
    ],
  },
  {
    tag: 'Interaction',
    title: 'Context Toolbar & Sibling Sync',
    desc: 'A floating toolbar follows the selected element with inline controls. Hold Alt or toggle the link icon to propagate changes to all siblings at once.',
    video: import.meta.env.BASE_URL + 'context-toolbar-sibling-sync.webm',
    details: [
      'Inline controls: layout direction, gap, padding, frameless, radius',
      'Split tool: divide elements into N children with one gesture',
      'Sibling sync: radius, color, frameless propagated via Alt or link toggle',
      'Color picker with shade carousel and used-color palette',
      'SDF glow + Z-lift effect when hovering palette colors',
    ],
  },
  {
    tag: 'Animation',
    title: 'Keyframe Timeline',
    desc: 'Animate any property — position, size, color, radius — with a visual timeline editor. Bind animations to click and hover triggers.',
    details: [
      'Keyframe tracks: x, y, width, height, color, radius',
      'Easing: linear, ease, ease-in, ease-out, ease-in-out, spring',
      'Spring physics: stiffness, damping, squash parameters',
      'Ghost preview: onion-skin overlay of intermediate frames',
      'Trigger binding: click / hover → animation bundle',
    ],
  },
  {
    tag: 'Export',
    title: 'LLM-Ready Markdown',
    desc: 'Export structured specs that LLMs can parse into real code. Platform-specific implementation hints for Web, iOS, and Android.',
    details: [
      'Component tree with hierarchy, type, color, layout',
      'Animation specs with timing and easing details',
      'Platform renderers: HTML/CSS Flexbox, SwiftUI, Jetpack Compose',
      'YAML project files (.choan) for save / load',
      'One-click clipboard copy',
    ],
  },
]

export default function LandingPage() {
  return (
    <div className="site" data-theme="dark">
      <SiteNav />

      {/* Hero */}
      <section className="hero">
        <p className="hero__badge">UX Idea → Prompt</p>
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
        </div>
        <div className="hero__image-wrap">
          <img
            src={import.meta.env.BASE_URL + 'landing.png'}
            alt="Choan editor screenshot"
            className="hero__image"
          />
        </div>
      </section>

      {/* Features */}
      <section className="features-grid">
        {FEATURES.map((f, i) => <Feature key={i} {...f} />)}
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <p>© 2026 DAY 1 COMPANY. All rights reserved.</p>
      </footer>
    </div>
  )
}
