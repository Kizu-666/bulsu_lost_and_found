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

export default function Dashboard() {
  const { items, loading, error } = useItems()
  const [showPost, setShowPost] = useState(false)
  const [result, setResult] = useState(null)

  const handleResult = (r) => {
    setResult(r)
    if (r.ok) setShowPost(false) // close the form on success, keep it open on failure
  }

  const count = (status) => items.filter((item) => item.status === status).length
  const trend = buildTrend(items)
  return (
    <div className="dash">
      <main className="dash-main">
        <div className="dash-heading">
          <div>
            <h1>Dashboard</h1>
            <p>Overview of the items recorded by the CICT LSC.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowPost(true)}>Post an item</button>
        </div>

        {error && <p className="dash-error" role="alert">{error}</p>}

        <section className="dash-stats" aria-label="Item totals">
          {STATS.map((s) => (
            <article key={s.status} className={`stat stat-${s.status}`}>
              <h2 className="stat-label">{s.label}</h2>
              <p className="stat-number">{loading ? '–' : count(s.status)}</p>
              <p className="stat-note">{s.note}</p>
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