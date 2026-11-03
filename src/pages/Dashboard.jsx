import { useState } from 'react'
import useItems from '../hooks/useItems'
import Modal from '../components/Modal'
import PostItem from './PostItem'
import './styles/Dashboard.css'
import TrendChart from '../components/TrendChart'
import { buildTrend } from '../utils/monthlyTrend'
import ResultDialog from '../components/ResultDialog'

const STATS = [
  { status: 'lost', label: 'Lost', note: 'Reported, not yet found' },
  { status: 'found', label: 'Found', note: 'Waiting to be claimed' },
  { status: 'claimed', label: 'Claimed', note: 'Returned to their owners' },
]

// Each status gets its own icon, so color is never the only cue
const ICONS = {
  lost: (
    <>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </>
  ),
  found: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  claimed: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7.8 12.3 3 3 5.4-6" />
    </>
  ),
}

function StatIcon({ status }) {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[status]}
    </svg>
  )
}

export default function Dashboard() {
  const { items, loading, error } = useItems()
  const [showPost, setShowPost] = useState(false)
  const [result, setResult] = useState(null)

  const handleResult = (r) => {
    setResult(r)
    if (r.ok) setShowPost(false)
  }

  const count = (status) => items.filter((item) => item.status === status).length
  const trend = buildTrend(items)
  return (
    <div className="dash">
      <main className="dash-main">
        <div className="dash-heading">
          <h1>Dashboard</h1>
          <button className="dash-post" onClick={() => setShowPost(true)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Post an Item
          </button>
        </div>
        <p className="dash-sub">Overview of the items recorded by the CICT LSC.</p>

        {error && <p className="dash-error" role="alert">{error}</p>}

        <section className="dash-stats" aria-label="Item totals">
          {STATS.map((s) => (
            <article key={s.status} className={`stat stat-${s.status}`}>
              <span className="stat-icon"><StatIcon status={s.status} /></span>
              <div className="stat-body">
                <h2 className="stat-label">{s.label}</h2>
                <p className="stat-number">{loading ? '–' : count(s.status)}</p>
                <p className="stat-note">{s.note}</p>
              </div>
            </article>
          ))}
        </section>

        <TrendChart data={trend} />
      </main>

      <Modal open={showPost} onClose={() => setShowPost(false)}>
        <PostItem onDone={() => setShowPost(false)} onResult={handleResult} />
      </Modal>

      <ResultDialog
        result={result}
        onPrimary={() => setResult(null)}
        onSecondary={() => {
          setResult(null)
          setShowPost(result?.ok ? true : false)
        }}
      />
    </div>
  )
}