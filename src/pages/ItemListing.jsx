import { useMemo, useState } from 'react'
import { ref, update, serverTimestamp } from 'firebase/database'
import { db } from '../firebase'
import useItems from '../hooks/useItems'
import ItemPhoto from '../components/ItemPhoto'
import Modal from '../components/Modal'
import './styles/ItemListing.css'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'lost', label: 'Lost' },
  { value: 'found', label: 'Found' },
  { value: 'claimed', label: 'Claimed' },
]

const PAGE_SIZE = 6 // pager shows only when items exceed this

const plural = (n) => (n > 1 ? 's' : '')

/* "Oct 12, 2024" + "10:30 AM" */
function splitDateTime(value) {
  if (!value) return { date: '—', time: '' }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '' }
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  }
}

/* ---------- Icons ---------- */
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="il-ico" aria-hidden="true">
    <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <path d="M16.5 16.5L21 21" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" className="il-ico" aria-hidden="true">
    <path
      d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
)

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" className="il-ico" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
)

/* ---------- Small components ---------- */
function StatusPill({ status }) {
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '—'
  return (
    <span className={`il-pill il-pill-${status}`}>
      <i aria-hidden="true" /> {label}
    </span>
  )
}

function ErrorText({ message }) {
  if (!message) return null
  return <p className="il-state il-state-error" role="alert">{message}</p>
}

export default function ItemListing() {
  const { items, loading, error } = useItems()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [place, setPlace] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const [selectedKeys, setSelectedKeys] = useState(new Set())
  const [viewing, setViewing] = useState(null) // item shown in the overlay
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  /* Unique locations for the dropdown */
  const places = useMemo(
    () => [...new Set(items.map((i) => i.place).filter(Boolean))].sort(),
    [items]
  )

  /* Search + filters, newest first */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromT = from ? new Date(`${from}T00:00:00`).getTime() : null
    const toT = to ? new Date(`${to}T23:59:59`).getTime() : null

    return items
      .filter((item) => {
        if (status !== 'all' && item.status !== status) return false
        if (place !== 'all' && item.place !== place) return false
        if (fromT || toT) {
          const t = new Date(item.date).getTime()
          if (Number.isNaN(t)) return false
          if (fromT && t < fromT) return false
          if (toT && t > toT) return false
        }
        if (q) {
          return [item.name, item.itemId, item.place, item.description]
            .filter(Boolean)
            .some((f) => f.toLowerCase().includes(q))
        }
        return true
      })
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }, [items, query, status, place, from, to])

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageItems = filtered.slice(start, start + PAGE_SIZE)
  const showPager = filtered.length > PAGE_SIZE

  /* Selection (only keys that still exist) */
  const validKeys = useMemo(() => new Set(items.map((i) => i.key)), [items])
  const selected = [...selectedKeys].filter((k) => validKeys.has(k))
  const allOnPageSelected = pageItems.length > 0 && pageItems.every((i) => selectedKeys.has(i.key))

  const toggleOne = (key) =>
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleAllOnPage = () =>
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      pageItems.forEach((i) => (allOnPageSelected ? next.delete(i.key) : next.add(i.key)))
      return next
    })

  const selectAllCheckbox = (
    <input
      type="checkbox"
      checked={allOnPageSelected}
      onChange={toggleAllOnPage}
      aria-label="Select all items on this page"
    />
  )

  /* Filter change handler, resets to page 1 */
  const onFilter = (setter) => (e) => {
    setter(e.target.value)
    setPage(1)
  }

  const clearFilters = () => {
    setQuery(''); setStatus('all'); setPlace('all'); setFrom(''); setTo(''); setPage(1)
  }
  const hasFilters = query || status !== 'all' || place !== 'all' || from || to

  /* ---------- Actions ---------- */
  const runAction = async (task, permissionMsg, failMsg) => {
    setBusy(true)
    setActionError('')
    try {
      await task()
    } catch (err) {
      console.error(err)
      setActionError(err?.code === 'PERMISSION_DENIED' ? permissionMsg : failMsg)
    }
    setBusy(false)
  }

  const handleRemove = () =>
    runAction(
      async () => {
        const updates = {}
        selected.forEach((key) => { updates[`items/${key}`] = null }) // null = delete
        await update(ref(db), updates)
        setSelectedKeys(new Set())
        setConfirmRemove(false)
      },
      'Your account does not have permission to remove items.',
      'Could not remove the items. Try again.'
    )

  const handleClaim = () => {
    if (!viewing) return
    return runAction(
      async () => {
        await update(ref(db, `items/${viewing.key}`), {
          status: 'claimed',
          claimedAt: serverTimestamp(),
        })
        setViewing(null)
      },
      'Your account does not have permission to claim items.',
      'Could not update the item. Try again.'
    )
  }

  const closeView = () => { setViewing(null); setActionError('') }

  // Keeps the overlay in sync with realtime Firebase updates
  const current = viewing ? items.find((i) => i.key === viewing.key) ?? viewing : null
  const when = current ? splitDateTime(current.date) : null

  return (
    <div className="il">
      <main className="il-main">
        <h1>Item Listing</h1>
        <p className="il-sub">View all lost and found items reported at the Main Campus.</p>

        {/* Filters */}
        <div className="il-controls">
          <label className="il-search">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={onFilter(setQuery)}
              placeholder="Search by item name, ID, or location..."
              aria-label="Search items"
            />
          </label>

          <details className="il-dropdown">
            <summary>Date Range</summary>
            <div className="il-dropdown-panel">
              <label>From <input type="date" value={from} onChange={onFilter(setFrom)} /></label>
              <label>To <input type="date" value={to} onChange={onFilter(setTo)} /></label>
            </div>
          </details>

          <select className="il-select" value={status} onChange={onFilter(setStatus)} aria-label="Filter by status">
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.value === 'all' ? 'Status' : f.label}
              </option>
            ))}
          </select>

          <select className="il-select" value={place} onChange={onFilter(setPlace)} aria-label="Filter by location">
            <option value="all">Location</option>
            {places.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          {hasFilters && (
            <button type="button" className="il-clear" onClick={clearFilters}>Clear</button>
          )}
        </div>

        {error && <p className="il-state il-state-error" role="alert">{error}</p>}

        {/* Table card */}
        <section className="il-card" aria-label="Items">
          <div className="il-toolbar">
            <label className="il-selectall">{selectAllCheckbox} All</label>

            {selected.length > 0 ? (
              <>
                <span className="il-selected">
                  {selected.length} item{plural(selected.length)} selected
                </span>
                <button
                  type="button"
                  className="il-remove il-remove-right"
                  onClick={() => { setActionError(''); setConfirmRemove(true) }}
                >
                  <TrashIcon /> Remove Item
                </button>
              </>
            ) : (
              <span className="il-hint">Select items to remove them.</span>
            )}
          </div>

          <div className="il-scroll">
            <table className="il-table">
              <thead>
                <tr>
                  <th className="il-col-check">{selectAllCheckbox}</th>
                  <th>Item ID</th>
                  <th>Item Name</th>
                  <th>Status</th>
                  <th>When Lost or Found</th>
                  <th>Where Lost or Found</th>
                  <th>Action (View)</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => {
                  const w = splitDateTime(item.date)
                  const isSel = selectedKeys.has(item.key)
                  return (
                    <tr key={item.key} className={isSel ? 'is-selected' : ''}>
                      <td className="il-col-check">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleOne(item.key)}
                          aria-label={`Select ${item.name}`}
                        />
                      </td>
                      <td className="il-id" data-label="Item ID">{item.itemId}</td>
                      <td className="il-cell-name">
                        <div className="il-name">
                          <div className="il-thumb">
                            <ItemPhoto src={item.imageUrl} alt="" width={400} fit="cover" />
                          </div>
                          <span className="il-name-text">{item.name}</span>
                        </div>
                      </td>
                      <td className="il-cell-status" data-label="Status"><StatusPill status={item.status} /></td>
                      <td data-label="When">
                        <div className="il-when">
                          <span className="il-date">{w.date}</span>
                          <span className="il-time">{w.time}</span>
                        </div>
                      </td>
                      <td data-label="Where">{item.place}</td>
                      <td className="il-cell-action">
                        <button type="button" className="il-view" onClick={() => setViewing(item)}>
                          <EyeIcon /> View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {loading && <p className="il-state">Loading items…</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="il-state">
              {items.length === 0 ? 'No items have been posted yet.' : 'No items match your search.'}
            </p>
          )}
        </section>

        {/* Count + pager */}
        {filtered.length > 0 && (
          <div className="il-footer">
            <span className="il-count">
              Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length} item{plural(filtered.length)}
            </span>

            {showPager && (
              <nav className="il-pager" aria-label="Pagination">
                <button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>← Previous</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={n === safePage ? 'is-active' : ''}
                    aria-current={n === safePage ? 'page' : undefined}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Next →</button>
              </nav>
            )}
          </div>
        )}
      </main>

      {/* Item details overlay */}
      <Modal open={!!current} onClose={closeView}>
        {current && (
          <div className="il-modal">
            <h2>Item Details</h2>
            <div className="il-modal-body">
              <div className="il-modal-photo">
                <ItemPhoto src={current.imageUrl} alt={current.name} width={800} fit="cover" showLabel />
              </div>
              <dl className="il-modal-fields">
                <dt>Item ID</dt><dd>{current.itemId}</dd>
                <dt>Item Name</dt><dd>{current.name}</dd>
                <dt>Status</dt><dd><StatusPill status={current.status} /></dd>
                <dt>When Lost or Found</dt><dd>{when.date}{when.time && `, ${when.time}`}</dd>
                <dt>Where Lost or Found</dt><dd>{current.place}</dd>
              </dl>
            </div>

            <h3 className="il-modal-label">Description</h3>
            <p className="il-modal-desc">{current.description || 'No description provided.'}</p>

            <ErrorText message={actionError} />

            {current.status === 'claimed' ? (
              <p className="il-claimed-note">This item has already been claimed.</p>
            ) : (
              <button type="button" className="il-claim" onClick={handleClaim} disabled={busy}>
                {busy ? 'Saving…' : 'Claim Item'}
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Confirm remove */}
      <Modal open={confirmRemove} onClose={() => !busy && setConfirmRemove(false)}>
        <div className="il-confirm">
          <h2>Remove {selected.length} item{plural(selected.length)}?</h2>
          <p>This will permanently delete the selected item{plural(selected.length)}. This can’t be undone.</p>
          <ErrorText message={actionError} />
          <div className="il-confirm-actions">
            <button type="button" className="btn-outline" onClick={() => setConfirmRemove(false)} disabled={busy}>Cancel</button>
            <button type="button" className="il-remove" onClick={handleRemove} disabled={busy}>
              {busy ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}