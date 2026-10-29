import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useItems from '../hooks/useItems'
import ItemPhoto from '../components/ItemPhoto'
import Modal from '../components/Modal'
import logo from '../assets/cict_logo.png'
import './styles/Browse.css'

const FILTERS = [
  { value: 'all', label: 'All Items' },
  { value: 'lost', label: 'Lost' },
  { value: 'found', label: 'Found' },
]

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A–Z)' },
]

const byNewest = (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)

/* "Oct 12, 2:30 PM" */
function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date}, ${time}`
}

/* ---------- Icons ---------- */
const PinIcon = () => (
  <svg className="bw-ico" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
    />
  </svg>
)

const ClockIcon = () => (
  <svg className="bw-ico" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const SearchIcon = () => (
  <svg className="bw-search-ico" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <path d="M16.5 16.5L21 21" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

const StarIcon = () => (
  <svg className="bw-star" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"
    />
  </svg>
)

const ChevronRight = () => (
  <svg className="bw-chev" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const InfoIcon = () => (
  <svg className="bw-info-ico" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="#3b8df0" />
    <rect x="10.8" y="10.5" width="2.4" height="7" rx="1.2" fill="#fff" />
    <circle cx="12" cy="7.3" r="1.4" fill="#fff" />
  </svg>
)

/* ---------- Small components ---------- */
function StatusPill({ status }) {
  return (
    <span className={`bw-pill bw-pill-${status}`}>
      {status === 'found' ? 'FOUND' : 'LOST'}
    </span>
  )
}

/* Place + time (row in featured, column in modal) */
function ItemMeta({ item, column = false }) {
  return (
    <p className={`bw-meta ${column ? 'bw-meta-col' : ''}`}>
      <span><PinIcon /> {item.place}</span>
      {item.date && (
        <>
          {!column && <i className="bw-meta-sep" aria-hidden="true" />}
          <span><ClockIcon /> {formatDateTime(item.date)}</span>
        </>
      )}
    </p>
  )
}

export default function Browse() {
  const { items, loading, error } = useItems()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [selected, setSelected] = useState(null)

  /* Filter, sort, and pick the featured item */
  const { featured, rest } = useMemo(() => {
    const q = query.trim().toLowerCase()

    let list = items.filter((item) => item.status !== 'claimed')
    if (filter !== 'all') list = list.filter((item) => item.status === filter)
    if (q) {
      list = list.filter((item) =>
        [item.name, item.place, item.itemId, item.description]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(q))
      )
    }

    const sorted = [...list].sort((a, b) => {
      if (sort === 'oldest') return -byNewest(a, b)
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '')
      return byNewest(a, b)
    })

    // Featured = newest match (not shown while searching)
    if (q || sorted.length === 0) return { featured: null, rest: sorted }
    const newest = [...list].sort(byNewest)[0]
    return { featured: newest, rest: sorted.filter((i) => i.key !== newest.key) }
  }, [items, query, filter, sort])

  const isEmpty = !loading && !error && !featured && rest.length === 0

  return (
    <div className="browse-page">
      {/* Header */}
      <header className="bw-header">
        <div className="bw-header-inner">
          <Link to="/" className="bw-brand">
            <img src={logo} alt="" className="bw-logo" />
            <span className="bw-brand-text">
              <strong>Lost and Found</strong>
              <small>Main Campus</small>
            </span>
          </Link>
          <nav className="bw-nav">
            <Link to="/">Home</Link>
            <a href="/#how-claiming-works">How It Works</a>
          </nav>
        </div>
      </header>

      {/* Info banner */}
      <div className="bw-banner">
        <div className="bw-banner-inner">
          <InfoIcon />
          <span>
            To claim an item, or for any concerns about a lost or found item,
            please go to the Local Student Council.
          </span>
        </div>
      </div>

      <main className="bw-main">
        <h1 className="bw-title">Browse Lost &amp; Found Items</h1>
        <p className="bw-subtitle">Search items reported around the Main Campus.</p>

        {/* Controls */}
        <div className="bw-controls">
          <label className="bw-search">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by item name, location, or ID..."
              aria-label="Search items"
            />
          </label>

          <div className="bw-filters" role="group" aria-label="Filter items">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`bw-chip ${filter === f.value ? 'is-active' : ''}`}
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="bw-sort">
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort items">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="bw-state">Loading items…</p>}
        {error && <p className="bw-state bw-state-error" role="alert">{error}</p>}
        {isEmpty && <p className="bw-state">No items found.</p>}

        {/* Featured item */}
        {featured && (
          <section className="bw-featured" aria-label="Featured item">
            <p className="bw-featured-label"><StarIcon /> FEATURED ITEM</p>
            <div className="bw-featured-body">
              <div className="bw-featured-photo">
                <ItemPhoto src={featured.imageUrl} alt={featured.name} width={400} fit="cover" />
              </div>

              <div className="bw-featured-info">
                <StatusPill status={featured.status} />
                <h2>{featured.name}</h2>
                <ItemMeta item={featured} />
                <p className="bw-desc">{featured.description}</p>
              </div>

              <button type="button" className="bw-btn-solid" onClick={() => setSelected(featured)}>
                View Details <ChevronRight />
              </button>
            </div>
          </section>
        )}

        {/* Recently reported */}
        {rest.length > 0 && (
          <>
            <h2 className="bw-section-title">
              {query ? 'Search Results' : 'Recently Reported Items'}
            </h2>
            <div className="bw-grid">
              {rest.map((item) => (
                <article key={item.key} className="bw-card">
                  <div className="bw-card-photo">
                    <ItemPhoto src={item.imageUrl} alt={item.name} width={300} fit="cover" />
                  </div>
                  <div className="bw-card-info">
                    <h3>{item.name}</h3>
                    <p className="bw-card-place"><PinIcon /> {item.place}</p>
                    <StatusPill status={item.status} />
                  </div>
                  <button type="button" className="bw-btn-outline" onClick={() => setSelected(item)}>
                    View
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bw-footer">
        <svg className="bw-wave" viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden="true">
          <path fill="#fdc79b" d="M0,60 C240,10 420,10 700,50 C980,90 1180,70 1440,20 L1440,160 L0,160 Z" />
          <path fill="#fb9d5f" d="M0,100 C260,55 520,40 760,70 C1020,102 1220,100 1440,60 L1440,160 L0,160 Z" />
          <path fill="#f9823a" d="M0,135 C300,100 560,95 820,115 C1080,135 1260,128 1440,105 L1440,160 L0,160 Z" />
        </svg>
        <div className="bw-footer-inner">
          <span>Lost and Found Main Campus</span>
          <span className="bw-footer-loc"><PinIcon /> Bulacan State University, Main Campus</span>
        </div>
      </footer>

      {/* Details modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="bw-modal">
            <div className="bw-modal-photo">
              <ItemPhoto src={selected.imageUrl} alt={selected.name} width={800} fit="cover" showLabel />
            </div>
            <StatusPill status={selected.status} />
            <h2>{selected.name}</h2>
            <p className="bw-modal-id">{selected.itemId}</p>
            <ItemMeta item={selected} column />
            <p className="bw-desc">{selected.description}</p>
            <p className="bw-modal-note">
              To claim this item, go to the Local Student Council and give the item ID above.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}