import { useEffect, useMemo, useRef, useState } from 'react'
import { ref, update, serverTimestamp } from 'firebase/database'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import useAccounts from '../hooks/useAccounts'
import useItems from '../hooks/useItems'
import ItemPhoto from '../components/ItemPhoto'
import Modal from '../components/Modal'
import ResultDialog from '../components/ResultDialog'
import PostItem from './PostItem'
import { LOCATIONS } from '../constants/locations'
import './styles/ItemListing.css'

const FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'lost', label: 'Lost' },
  { value: 'found', label: 'Found' },
  { value: 'claimed', label: 'Claimed' },
]

const PAGE_SIZE = 6 // pager shows only when items exceed this
const EMPTY_CLAIM = { studentId: '', studentName: '', contactNumber: '' }
const STUDENT_NO = /^\d{10}$/
const PH_MOBILE = /^09\d{9}$/
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

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" className="il-ico" aria-hidden="true">
    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
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

function FormError({ message, id }) {
  const lines = (Array.isArray(message) ? message : [message]).filter(Boolean)
  if (lines.length === 0) return null
  return (
    <div className="il-form-error" id={id} role="alert">
      <svg className="il-form-error-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M12 3 2 21h20L12 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 10v5M12 17.8v.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {lines.length === 1 ? (
        <span>{lines[0]}</span>
      ) : (
        <ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul>
      )}
    </div>
  )
}

/* One dropdown shell for Date Range, Status and Location:
   same button, same arrow, same open color. Only one can be open at a time. */
function Dropdown({ id, label, open, setOpen, btnRef, popup = 'true', className = '', onButtonKeyDown, children }) {
  const close = () => {
    setOpen(null)
    btnRef.current?.focus()
  }
  return (
    <div className={`il-dropdown ${className}${open ? ' is-open' : ''}`}>
      <button
        ref={btnRef}
        type="button"
        className="il-dropdown-btn"
        aria-haspopup={popup}
        aria-expanded={open}
        aria-controls={open ? `il-menu-${id}` : undefined}
        onClick={() => setOpen(open ? null : id)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) setOpen(null)
          onButtonKeyDown?.(e)
        }}
      >
        {label}
      </button>
      {open && (
        <div
          className="il-dropdown-panel"
          id={`il-menu-${id}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); close() }
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/* Status / Location: custom list (keyboard: arrows, Home/End, Enter/Space, Esc) */
function SelectMenu({ id, value, options, onChange, ariaLabel, open, setOpen }) {
  const btnRef = useRef(null)
  const listRef = useRef(null)
  const current = options.find((o) => o.value === value) ?? options[0]

  /* move focus into the list when it opens */
  useEffect(() => {
    if (!open) return
    const list = listRef.current
    const target = list?.querySelector('[aria-selected="true"]') ?? list?.querySelector('[role="option"]')
    target?.focus()
  }, [open])

  const choose = (v) => {
    onChange(v)
    setOpen(null)
    btnRef.current?.focus()
  }

  const onListKey = (e) => {
    const opts = [...listRef.current.querySelectorAll('[role="option"]')]
    const i = opts.indexOf(document.activeElement)
    let next = null
    if (e.key === 'ArrowDown') next = opts[(i + 1) % opts.length]
    else if (e.key === 'ArrowUp') next = opts[(i - 1 + opts.length) % opts.length]
    else if (e.key === 'Home') next = opts[0]
    else if (e.key === 'End') next = opts[opts.length - 1]
    if (next) {
      e.preventDefault()
      next.focus()
    }
  }

  return (
    <Dropdown
      id={id}
      label={current.label}
      open={open}
      setOpen={setOpen}
      btnRef={btnRef}
      popup="listbox"
      className="il-dropdown-select"
      onButtonKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          setOpen(id)
        }
      }}
    >
      <ul className="il-menu" role="listbox" aria-label={ariaLabel} ref={listRef} onKeyDown={onListKey}>
        {options.map((o) => (
          <li
            key={o.value}
            role="option"
            tabIndex={-1}
            className="il-menu-opt"
            aria-selected={o.value === value}
            onClick={() => choose(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                choose(o.value)
              }
            }}
          >
            {o.label}
          </li>
        ))}
      </ul>
    </Dropdown>
  )
}

/* Feedback message after an action (auto-hides) */
function Toast({ notice, onClose }) {
  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [notice, onClose])

  if (!notice) return null
  return (
    <div className="il-toast" role="status" aria-live="polite">
      <span>{notice}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss message">×</button>
    </div>
  )
}

export default function ItemListing() {
  const { items, loading, error } = useItems()
  const { user } = useAuth()
  const { accounts } = useAccounts()
  const myAccount = accounts.find((a) => a.uid === user?.uid) // name comes from the Account List

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [place, setPlace] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  /* which dropdown is open: null | 'date' | 'status' | 'place' (only one at a time) */
  const [openMenu, setOpenMenu] = useState(null)
  const dateBtnRef = useRef(null)
  const placeOptions = [
    { value: 'all', label: 'All Locations' },
    ...LOCATIONS.map((p) => ({ value: p, label: p })),
  ]

  /* Tabbing out of an open dropdown closes it */
  useEffect(() => {
    if (!openMenu) return undefined
    const closeIfOutside = (e) => {
      if (!e.target.closest?.('.il-dropdown.is-open')) setOpenMenu(null)
    }
    document.addEventListener('focusin', closeIfOutside)
    return () => document.removeEventListener('focusin', closeIfOutside)
  }, [openMenu])

  const [selectedKeys, setSelectedKeys] = useState(new Set())
  const [viewing, setViewing] = useState(null) // item shown in the overlay
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('') // success feedback
  const [claiming, setClaiming] = useState(false) // claim form open?
  const [claim, setClaim] = useState(EMPTY_CLAIM)

  /* Add Item = same as "Post an Item" on the Dashboard */
  const [showPost, setShowPost] = useState(false)
  const [result, setResult] = useState(null)
  const [claimInvalid, setClaimInvalid] = useState({})

  const handleResult = (r) => {
    setResult(r)
    if (r.ok) setShowPost(false)
  }

  /* Search + filters, newest first */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromT = from ? new Date(`${from}T00:00:00`).getTime() : null
    const toT = to ? new Date(`${to}T23:59:59`).getTime() : null

    return items
      .filter((item) => {
        if (status !== 'all' && item.status !== status) return false
        if (place !== 'all' && (item.placeCategory || item.place) !== place) return false
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
  const runAction = async (task, permissionMsg, failMsg, successMsg) => {
    setBusy(true)
    setActionError('')
    try {
      await task()
      if (successMsg) setNotice(successMsg)
    } catch (err) {
      console.error(err)
      setActionError(err?.code === 'PERMISSION_DENIED' ? permissionMsg : failMsg)
    }
    setBusy(false)
  }

  const handleRemove = () => {
    const count = selected.length
    return runAction(
      async () => {
        const updates = {}
        selected.forEach((key) => { updates[`items/${key}`] = null }) // null = delete
        await update(ref(db), updates)
        setSelectedKeys(new Set())
        setConfirmRemove(false)
      },
      'Your account does not have permission to remove items.',
      'Could not remove the items. Try again.',
      `${count} item${plural(count)} removed successfully.`
    )
  }

  /* LOST item -> someone found it: status becomes "found" */
  const handleFound = () => {
    if (!viewing) return
    return runAction(
      async () => {
        await update(ref(db, `items/${viewing.key}`), {
          status: 'found',
          foundAt: serverTimestamp(),
        })
        setViewing(null)
      },
      'Your account does not have permission to update items.',
      'Could not update the item. Try again.',
      'Item marked as found.'
    )
  }

  /* FOUND item -> owner claims it (with claiming form) */
  const onClaimField = (e) => {
    const { name } = e.target
    let value = e.target.value

    if (name === 'studentId') {
      value = value.replace(/\D/g, '').slice(0, 10)
    }

    if (name === 'contactNumber') {
      let digits = value.replace(/\D/g, '')
      if (digits.startsWith('639')) digits = `0${digits.slice(2)}`
      value = digits.slice(0, 11)
    }

    setClaim((prev) => ({ ...prev, [name]: value }))
    setClaimInvalid((prev) => (prev[name] ? { ...prev, [name]: false } : prev))
  }

  const handleClaim = (e) => {
    e.preventDefault()
    if (!viewing) return
    setActionError('')
    setClaimInvalid({})

    const studentId = claim.studentId.trim()
    const studentName = claim.studentName.trim()
    const contactNumber = claim.contactNumber.trim()

    const errors = {}

    if (!studentId) errors.studentId = 'Enter the student number.'
    else if (!STUDENT_NO.test(studentId)) errors.studentId = 'Student number must be 10 digits (e.g. 2020100450).'

    if (!studentName) errors.studentName = 'Enter the student name.'

    if (!contactNumber) errors.contactNumber = 'Enter the contact number.'
    else if (!PH_MOBILE.test(contactNumber)) errors.contactNumber = 'Contact number must be 11 digits starting with 09 (e.g. 09123456789).'

    if (Object.keys(errors).length > 0) {
      setClaimInvalid(Object.fromEntries(Object.keys(errors).map((k) => [k, true])))
      setActionError(Object.values(errors))
      return
    }

    return runAction(
      async () => {
        await update(ref(db, `items/${viewing.key}`), {
          status: 'claimed',
          claimedAt: serverTimestamp(),
          claimedBy: { studentId, studentName, contactNumber },
          // account (LSC officer / super admin) who processed the claim
          processedBy: {
            uid: user?.uid ?? null,
            name: myAccount?.name || user?.displayName || user?.email || 'Unknown account',
          },
        })
        setViewing(null)
        setClaiming(false)
        setClaim(EMPTY_CLAIM)
      },
      'Your account does not have permission to claim items.',
      'Could not update the item. Try again.',
      'Item claimed successfully.'
    )
  }

  const openView = (item) => {
    setClaiming(false)
    setClaim(EMPTY_CLAIM)
    setClaimInvalid({})
    setActionError('')
    setViewing(item)
  }

  const closeView = () => {
    setViewing(null)
    setActionError('')
    setClaiming(false)
    setClaim(EMPTY_CLAIM)
    setClaimInvalid({})
  }

  // Keeps the overlay in sync with realtime Firebase updates
  const current = viewing ? items.find((i) => i.key === viewing.key) ?? viewing : null
  const when = current ? splitDateTime(current.date) : null
  const claimedWhen = current?.claimedAt ? splitDateTime(current.claimedAt) : null

  return (
    <div className="il">
      <main className="il-main">
        <div className="il-head">
          <h1>Item Listing</h1>
          <button type="button" className="il-add" onClick={() => setShowPost(true)}>
            <PlusIcon /> Post an Item
          </button>
        </div>
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

          {/* While a dropdown is open, this catches clicks so nothing else can be pressed */}
          {openMenu && <div className="il-backdrop" aria-hidden="true" onClick={() => setOpenMenu(null)} />}

          <Dropdown id="date" label="Date Range" open={openMenu === 'date'} setOpen={setOpenMenu} btnRef={dateBtnRef}>
            <label>From <input type="date" value={from} onChange={onFilter(setFrom)} /></label>
            <label>To <input type="date" value={to} onChange={onFilter(setTo)} /></label>
          </Dropdown>

          <SelectMenu
            id="status"
            ariaLabel="Filter by status"
            value={status}
            options={FILTERS}
            onChange={(v) => { setStatus(v); setPage(1) }}
            open={openMenu === 'status'}
            setOpen={setOpenMenu}
          />

          <SelectMenu
            id="place"
            ariaLabel="Filter by location"
            value={place}
            options={placeOptions}
            onChange={(v) => { setPlace(v); setPage(1) }}
            open={openMenu === 'place'}
            setOpen={setOpenMenu}
          />

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
                  <th>Action</th>
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
                        <button type="button" className="il-view" onClick={() => openView(item)}>
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

            {current.status === 'claimed' && (
              <section className="il-claimed-by" aria-label="Claimed by">
                <h3 className="il-modal-label">Claimed By</h3>
                {current.claimedBy ? (
                  <dl className="il-claimed-fields">
                    <dt>Student Name</dt>
                    <dd>{current.claimedBy.studentName}</dd>
                    <dt>Student ID / Number</dt>
                    <dd>{current.claimedBy.studentId}</dd>
                    <dt>Contact Number</dt>
                    <dd>
                      <a href={`tel:${current.claimedBy.contactNumber}`}>
                        {current.claimedBy.contactNumber}
                      </a>
                    </dd>
                    {current.processedBy?.name && (
                      <>
                        <dt>Processed By</dt>
                        <dd>{current.processedBy.name}</dd>
                      </>
                    )}
                    {claimedWhen && (
                      <>
                        <dt>Date Claimed</dt>
                        <dd>{claimedWhen.date}{claimedWhen.time && `, ${claimedWhen.time}`}</dd>
                      </>
                    )}
                  </dl>
                ) : (
                  <p className="il-claimed-note">This item has already been claimed.</p>
                )}
              </section>
            )}
            {!claiming && <FormError message={actionError} />}
            {/* LOST -> Found Item button */}
            {current.status === 'lost' && (
              <button type="button" className="il-claim" onClick={handleFound} disabled={busy}>
                {busy ? 'Saving…' : 'Found Item'}
              </button>
            )}

            {/* FOUND -> Claim Item button, then claiming form */}
            {current.status === 'found' && !claiming && (
              <button
                type="button"
                className="il-claim"
                onClick={() => { setActionError(''); setClaiming(true) }}
              >
                Claim Item
              </button>
            )}

            {current.status === 'found' && claiming && (
              <form className="il-claim-form" onSubmit={handleClaim} noValidate>
                <h3 className="il-modal-label">Claiming Form</h3>
                <label>
                  Student Number
                  <input
                    name="studentId"
                    value={claim.studentId}
                    onChange={onClaimField}
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="off"
                    placeholder="e.g. 2020100450"
                    aria-invalid={claimInvalid.studentId ? 'true' : undefined}
                    aria-describedby={claimInvalid.studentId ? 'claim-error' : undefined}
                    required
                  />
                </label>
                <label>
                  Student Name
                  <input
                    name="studentName"
                    value={claim.studentName}
                    onChange={onClaimField}
                    autoComplete="name"
                    placeholder="e.g. Juan Dela Cruz"
                    aria-invalid={claimInvalid.studentName ? 'true' : undefined}
                    aria-describedby={claimInvalid.studentName ? 'claim-error' : undefined}
                    required
                  />
                </label>
                <label>
                  Contact Number
                  <input
                    name="contactNumber"
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    value={claim.contactNumber}
                    onChange={onClaimField}
                    autoComplete="tel"
                    placeholder="e.g. 09123456789"
                    aria-invalid={claimInvalid.contactNumber ? 'true' : undefined}
                    aria-describedby={claimInvalid.contactNumber ? 'claim-error' : undefined}
                    required
                  />
                </label>
                <FormError message={actionError} id="claim-error" />
                <div className="il-claim-actions">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => { setClaiming(false); setActionError(''); setClaimInvalid({}) }}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="il-claim" disabled={busy}>
                    {busy ? 'Saving…' : 'Submit Claim'}
                  </button>
                </div>
              </form>
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

      {/* Add Item (same flow as Dashboard's Post an Item) */}
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

      {/* Feedback message */}
      <Toast notice={notice} onClose={() => setNotice('')} />
    </div>
  )
}