import { Link } from 'react-router-dom'
import SiteNav from './SiteNav'

interface FeatureProps {
  tag: string
  title: string
  desc: string
  details: string[]
}

function Feature({ tag, title, desc, details }: FeatureProps) {
  return (
    <div className="feature">
      <span className="feature__tag">{tag}</span>
      <h2 className="feature__title">{title}</h2>
      <p className="feature__desc">{desc}</p>
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
    desc: 'Drag a rectangle and turn it into a real UI component. Buttons, switches, sliders, avatars, tables — each with interactive state.',
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
    desc: 'Flexbox-inspired container layout. Drop elements into containers and they arrange themselves — row, column, or grid.',
    details: [
      'Layout directions: Free, Row, Column, Grid',
      'Gap, Padding, Column count controls',
      'Child sizing: Equal, Fill, Fixed Ratio, Fixed Pixel',
      'Auto-reparent on drag into container',
      'Device frames: Browser (16:10) and Mobile (iPhone) with safe insets',
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
    tag: 'Interaction',
    title: 'Context Toolbar & Sibling Sync',
    desc: 'A floating toolbar follows the selected element with inline controls. Hold Alt or toggle the link icon to propagate changes to all siblings at once.',
    details: [
      'Inline controls: layout direction, gap, padding, frameless, radius',
      'Split tool: divide elements into N children with one gesture',
      'Sibling sync: radius, color, frameless propagated via Alt or link toggle',
      'Color picker with shade carousel and used-color palette',
      'SDF glow + Z-lift effect when hovering palette colors',
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

export default function FeaturesPage() {
  return (
    <div className="site" data-theme="dark">
      <SiteNav />

      <section className="features-hero">
        <h1 className="features-hero__title">
          Everything you need to<br />
          <span className="gradient-text">design for AI.</span>
        </h1>
        <p className="features-hero__sub">
          Built from scratch with a custom 3D rendering engine,
          every feature is designed to bridge design and LLM prompts.
        </p>
      </section>

      <section className="features-grid">
        {FEATURES.map((f, i) => <Feature key={i} {...f} />)}
      </section>

      <section className="features-cta">
        <h2>Ready to try?</h2>
        <Link to="/app" className="btn-primary">Open App</Link>
      </section>

      <footer className="site-footer">
        <p>Built with WebGL2 SDF Ray Marching</p>
      </footer>
    </div>
  )
}
