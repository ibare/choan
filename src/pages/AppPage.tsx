import { lazy, Suspense } from 'react'

const App = lazy(() => import('../App'))

export default function AppPage() {
  return (
    <Suspense fallback={<div className="app-loading">Loading Choan...</div>}>
      <App />
    </Suspense>
  )
}
