import { useEffect, useMemo, useRef, useState } from 'react'
import { ref, update, get, onValue, serverTimestamp } from 'firebase/database'
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
import SelectMenu, { Dropdown } from '../components/SelectMenu'
import { uploadImage, validateImage } from '../utils/uploadImage'
import { STUDENT_NO, PH_MOBILE, cleanStudentNo, cleanPhone } from '../utils/validators'

const FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'lost', label: 'Lost' },
  { value: 'found', label: 'Found' },
  { value: 'claimed', label: 'Claimed' },
]

const PAGE_SIZE = 6 // pager shows only when items exceed this
const EMPTY_CLAIM = { studentId: '', studentName: '', contactNumber: '', proofOfOwnership: '' }
const plural = (n) => (n > 1 ? 's' : '')
const EMPTY_FOUND = {
  day: '', time: '', place: '', customPlace: '',
  finderName: '', finderStudentId: '', finderContact: '',
}
const PLACE_OPTIONS = LOCATIONS.map((p) => ({ value: p, label: p }))

function nowParts() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  const iso = d.toISOString().slice(0, 16)
  return { today: iso.slice(0, 10), nowTime: iso.slice(11, 16) }
}

/* turnedInBy is a group now; older items saved just the name as text */
function finderOf(item) {
  const t = item?.turnedInBy
  if (!t) return null
  return typeof t === 'string' ? { name: t } : t
}


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
  const { accounts } = useAccounts() // full list: admins only (officers get an empty list)

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
  const [liveName, setLiveName] = useState('') // current name of whoever processed the open claim

  /* Lost -> found form */
  const [markingFound, setMarkingFound] = useState(false) // found form open?
  const [found, setFound] = useState(EMPTY_FOUND)
  const [foundInvalid, setFoundInvalid] = useState({})
  const [foundFile, setFoundFile] = useState(null)
  const [foundPreview, setFoundPreview] = useState('')
  const [foundMenu, setFoundMenu] = useState(null) // null | 'found-place'
  const foundFileInput = useRef(null)
  const { today, nowTime } = nowParts()

  /* Add Item = same as "Post an Item" on the Dashboard */
  const [showPost, setShowPost] = useState(false)
  const [result, setResult] = useState(null)
  const [claimInvalid, setClaimInvalid] = useState({})

  /* Free the preview image when it changes or the page closes */
  useEffect(() => {
    return () => {
      if (foundPreview) URL.revokeObjectURL(foundPreview)
    }
  }, [foundPreview])

  /* Clicking or tabbing out of the open location list closes it */
  useEffect(() => {
    if (!foundMenu) return undefined
    const closeIfOutside = (e) => {
      if (!e.target.closest?.('.il-dropdown.is-open')) setFoundMenu(null)
    }
    document.addEventListener('focusin', closeIfOutside)
    document.addEventListener('pointerdown', closeIfOutside)
    return () => {
      document.removeEventListener('focusin', closeIfOutside)
      document.removeEventListener('pointerdown', closeIfOutside)
    }
  }, [foundMenu])

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
          return [item.name, item.itemId, item.place, item.description, item.lostBy?.name]
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

  /* LOST item -> someone found it: ask for the found details first */
  const resetFound = () => {
    setMarkingFound(false)
    setFound(EMPTY_FOUND)
    setFoundInvalid({})
    setFoundFile(null)
    setFoundPreview('')
    setFoundMenu(null)
  }

  const onFoundField = (e) => {
    const { name } = e.target
    let value = e.target.value
    if (name === 'finderStudentId') value = cleanStudentNo(value)
    if (name === 'finderContact') value = cleanPhone(value)
    setFound((prev) => ({ ...prev, [name]: value }))
    setFoundInvalid((prev) => (prev[name] ? { ...prev, [name]: false } : prev))
  }

  const onFoundPlace = (value) => {
    setFound((prev) => ({ ...prev, place: value, customPlace: '' }))
    setFoundInvalid((prev) => ({ ...prev, place: false, customPlace: false }))
  }

  const onFoundFile = (e) => {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return

    const problem = validateImage(picked)
    if (problem) {
      setFoundInvalid((prev) => ({ ...prev, photo: true }))
      setActionError(problem)
      return
    }

    setActionError('')
    setFoundInvalid((prev) => ({ ...prev, photo: false }))
    setFoundFile(picked)
    setFoundPreview(URL.createObjectURL(picked))
  }

  const removeFoundPhoto = () => {
    setFoundFile(null)
    setFoundPreview('')
  }

  const handleFound = (e) => {
    e.preventDefault()
    if (!viewing) return
    setActionError('')
    setFoundInvalid({})

    const now = nowParts()
    const future =
      !!found.day && !!found.time &&
      (found.day > now.today || (found.day === now.today && found.time > now.nowTime))

    const bad = {
      day: !found.day || future,
      time: !found.time || future,
      place: !found.place,
      customPlace: found.place === 'Others' && !found.customPlace.trim(),
      finderName: !found.finderName.trim(),
      finderStudentId: !!found.finderStudentId && !STUDENT_NO.test(found.finderStudentId),
      finderContact: !PH_MOBILE.test(found.finderContact),
      photo: !foundFile,
    }

    const messages = []
    if (!found.day || !found.time) messages.push('Enter when the item was found.')
    else if (future) messages.push('The date and time cannot be in the future.')
    if (bad.place) messages.push('Select where the item was found.')
    else if (bad.customPlace) messages.push('Enter the specific location.')
    if (bad.finderName) messages.push('Enter the name of the person who turned in the item.')
    if (bad.finderStudentId) messages.push('Student number must be 10 digits (e.g. 2020100450).')
    if (!found.finderContact) messages.push('Enter the contact number of the person who turned in the item.')
    else if (bad.finderContact) messages.push('Contact number must be 11 digits starting with 09 (e.g. 09123456789).')
    if (bad.photo) messages.push('Add a photo of the found item.')

    if (messages.length > 0) {
      setFoundInvalid(bad)
      setActionError(messages)
      return
    }

    return runAction(
      async () => {
        const imageUrl = await uploadImage(foundFile)
        await update(ref(db, `items/${viewing.key}`), {
          status: 'found',
          foundAt: serverTimestamp(),
          date: `${found.day}T${found.time}`,
          place: found.place === 'Others' ? found.customPlace.trim() : found.place,
          placeCategory: found.place,
          imageUrl,
          turnedInBy: {
            name: found.finderName.trim(),
            contactNumber: found.finderContact,
            ...(found.finderStudentId ? { studentId: found.finderStudentId } : {}),
          },
          // keep the original lost report
          lostReport: {
            date: viewing.date ?? null,
            place: viewing.place ?? null,
            placeCategory: viewing.placeCategory ?? null,
            imageUrl: viewing.imageUrl ?? null,
          },
        })
        setViewing(null)
        resetFound()
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
    const proofOfOwnership = claim.proofOfOwnership.trim()

    const errors = {}

    if (!studentName) errors.studentName = 'Enter the name.'

    if (studentId && !STUDENT_NO.test(studentId)) {
      errors.studentId = 'Student number must be 10 digits (e.g. 2020100450), or leave it blank.'
    }

    if (!contactNumber) errors.contactNumber = 'Enter the contact number.'
    else if (!PH_MOBILE.test(contactNumber)) errors.contactNumber = 'Contact number must be 11 digits starting with 09 (e.g. 09123456789).'

    if (!proofOfOwnership) errors.proofOfOwnership = 'Enter the proof of ownership.'
    else if (proofOfOwnership.length < 10) errors.proofOfOwnership = 'Describe the proof of ownership in at least 10 characters.'

    if (Object.keys(errors).length > 0) {
      setClaimInvalid(Object.fromEntries(Object.keys(errors).map((k) => [k, true])))
      setActionError(Object.values(errors))
      return
    }

    return runAction(
      async () => {
        // own record: readable by both admins and officers
        const nameSnap = await get(ref(db, `users/${user.uid}/name`))
        const officerName = nameSnap.val() || user?.displayName || 'Unknown account'

        await update(ref(db, `items/${viewing.key}`), {
          status: 'claimed',
          claimedAt: serverTimestamp(),
          claimedBy: {
            studentName,
            contactNumber,
            proofOfOwnership,
            ...(studentId ? { studentId } : {}),
          },
          // account (LSC officer / super admin) who processed the claim
          processedBy: {
            uid: user?.uid ?? null,
            name: officerName,
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
    resetFound()
  }

  const closeView = () => {
    setViewing(null)
    setActionError('')
    setClaiming(false)
    setClaim(EMPTY_CLAIM)
    setClaimInvalid({})
    resetFound()
  }

  // Keeps the overlay in sync with realtime Firebase updates
  const current = viewing ? items.find((i) => i.key === viewing.key) ?? viewing : null
  const when = current ? splitDateTime(current.date) : null
  const finder = finderOf(current)
  const claimedWhen = current?.claimedAt ? splitDateTime(current.claimedAt) : null

  /* Live name of whoever processed the claim (name is readable by every signed-in account).
     Falls back to the list (admins) and then to the name saved with the claim. */
  const processedUid = current?.processedBy?.uid
  useEffect(() => {
    setLiveName('')
    if (!processedUid) return undefined
    return onValue(
      ref(db, `users/${processedUid}/name`),
      (snap) => setLiveName(snap.val() || ''),
      () => setLiveName('')
    )
  }, [processedUid])

  const processedByName =
    liveName ||
    accounts.find((a) => a.uid === processedUid)?.name ||
    current?.processedBy?.name

  return (
    <div className="il">
      <main className="il-main">
        <div className="il-head">
          <h1>Item Listing</h1>
          <button type="button" className="il-add" onClick={() => setShowPost(true)}>
            <PlusIcon /> Post an Item
          </button>
        </div>
        <p className="il-sub">View all lost and found items reported around Pimentel Hall.</p>

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

            {current.lostBy && (
              <section className="il-claimed-by il-lost-by" aria-label="Lost by">
                <h3 className="il-modal-label">Lost By</h3>
                <dl className="il-claimed-fields">
                  <dt>Name</dt>
                  <dd>{current.lostBy.name}</dd>
                  {current.lostBy.studentId && (
                    <>
                      <dt>Student Number</dt>
                      <dd>{current.lostBy.studentId}</dd>
                    </>
                  )}
                  {current.lostBy.contactNumber && (
                    <>
                      <dt>Contact Number</dt>
                      <dd>
                        <a href={`tel:${current.lostBy.contactNumber}`}>{current.lostBy.contactNumber}</a>
                      </dd>
                    </>
                  )}
                </dl>
              </section>
            )}

            {finder && (
              <section className="il-claimed-by il-finder-by" aria-label="Turned in by">
                <h3 className="il-modal-label">Turned In By</h3>
                <dl className="il-claimed-fields">
                  <dt>Name</dt>
                  <dd>{finder.name}</dd>
                  {finder.studentId && (
                    <>
                      <dt>Student Number</dt>
                      <dd>{finder.studentId}</dd>
                    </>
                  )}
                  {finder.contactNumber && (
                    <>
                      <dt>Contact Number</dt>
                      <dd>
                        <a href={`tel:${finder.contactNumber}`}>{finder.contactNumber}</a>
                      </dd>
                    </>
                  )}
                </dl>
              </section>
            )}

            {current.status === 'claimed' && (
              <section className="il-claimed-by" aria-label="Claimed by">
                <h3 className="il-modal-label">Claimed By</h3>
                {current.claimedBy ? (
                  <dl className="il-claimed-fields">
                    <dt>Name</dt>
                    <dd>{current.claimedBy.studentName}</dd>
                    {current.claimedBy.studentId && (
                      <>
                        <dt>Student Number</dt>
                        <dd>{current.claimedBy.studentId}</dd>
                      </>
                    )}
                    <dt>Contact Number</dt>
                    <dd>
                      <a href={`tel:${current.claimedBy.contactNumber}`}>
                        {current.claimedBy.contactNumber}
                      </a>
                    </dd>
                    {current.claimedBy.proofOfOwnership && (
                      <>
                        <dt className="il-wide">Proof of Ownership</dt>
                        <dd className="il-wide">{current.claimedBy.proofOfOwnership}</dd>
                      </>
                    )}
                    {processedByName && (
                      <>
                        <dt>Processed By</dt>
                        <dd>{processedByName}</dd>
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

            {!claiming && !markingFound && <FormError message={actionError} />}

            {/* LOST -> Found Item button, then the found form */}
            {current.status === 'lost' && !markingFound && (
              <button
                type="button"
                className="il-claim"
                onClick={() => { setActionError(''); setMarkingFound(true) }}
              >
                Found Item
              </button>
            )}

            {current.status === 'lost' && markingFound && (
              <form className="il-claim-form" onSubmit={handleFound} noValidate>
                <h3 className="il-modal-label">Found Details</h3>

                <div className="il-field">
                  <span id="found-when-label">When found</span>
                  <div className="il-found-when" role="group" aria-labelledby="found-when-label">
                    <input
                      name="day"
                      type="date"
                      aria-label="Date found"
                      max={today}
                      value={found.day}
                      onChange={onFoundField}
                      aria-invalid={foundInvalid.day ? 'true' : undefined}
                      aria-describedby={foundInvalid.day ? 'found-error' : undefined}
                      required
                    />
                    <input
                      name="time"
                      type="time"
                      aria-label="Time found"
                      max={found.day === today ? nowTime : undefined}
                      value={found.time}
                      onChange={onFoundField}
                      aria-invalid={foundInvalid.time ? 'true' : undefined}
                      aria-describedby={foundInvalid.time ? 'found-error' : undefined}
                      required
                    />
                  </div>
                </div>

                <div className={`il-field${foundInvalid.place ? ' is-invalid' : ''}`}>
                  <span>Where found</span>
                  <SelectMenu
                    id="found-place"
                    ariaLabel="Where found"
                    value={found.place}
                    options={PLACE_OPTIONS}
                    placeholder="Select location"
                    onChange={onFoundPlace}
                    open={foundMenu === 'found-place'}
                    setOpen={setFoundMenu}
                  />
                  {found.place === 'Others' && (
                    <input
                      name="customPlace"
                      maxLength={80}
                      value={found.customPlace}
                      onChange={onFoundField}
                      autoComplete="off"
                      aria-label="Specific location"
                      placeholder="Enter specific location"
                      aria-invalid={foundInvalid.customPlace ? 'true' : undefined}
                      aria-describedby={foundInvalid.customPlace ? 'found-error' : undefined}
                      required
                    />
                  )}
                </div>

                <section className="post-section" aria-labelledby="found-finder-heading">
                  <h3 id="found-finder-heading">Turned in by</h3>

                  <label>
                    Name
                    <input
                      name="finderName"
                      maxLength={80}
                      value={found.finderName}
                      onChange={onFoundField}
                      autoComplete="off"
                      placeholder="e.g. Juan Dela Cruz"
                      aria-invalid={foundInvalid.finderName ? 'true' : undefined}
                      aria-describedby={foundInvalid.finderName ? 'found-error' : undefined}
                      required
                    />
                  </label>

                  <label>
                    Student number (optional)
                    <input
                      name="finderStudentId"
                      value={found.finderStudentId}
                      onChange={onFoundField}
                      inputMode="numeric"
                      maxLength={10}
                      autoComplete="off"
                      placeholder="e.g. 2020100450"
                      aria-invalid={foundInvalid.finderStudentId ? 'true' : undefined}
                      aria-describedby={foundInvalid.finderStudentId ? 'found-error' : undefined}
                    />
                  </label>

                  <label>
                    Contact number
                    <input
                      name="finderContact"
                      type="tel"
                      value={found.finderContact}
                      onChange={onFoundField}
                      inputMode="numeric"
                      maxLength={11}
                      autoComplete="off"
                      placeholder="e.g. 09123456789"
                      aria-invalid={foundInvalid.finderContact ? 'true' : undefined}
                      aria-describedby={foundInvalid.finderContact ? 'found-error' : undefined}
                      required
                    />
                  </label>
                </section>

                <div className={`il-field${foundInvalid.photo ? ' is-invalid' : ''}`}>
                  <span>Photo</span>
                  <div className={`photo-box${foundPreview ? ' has-image' : ''}`}>
                    {foundPreview ? (
                      <img src={foundPreview} alt="Selected item preview" className="photo-img" />
                    ) : (
                      <button
                        type="button"
                        className="photo-empty"
                        onClick={() => foundFileInput.current?.click()}
                      >
                        <span className="photo-empty-title">Choose a photo</span>
                        <span className="photo-empty-hint">JPG, PNG, or WebP, up to 5 MB</span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={foundFileInput}
                    type="file"
                    hidden
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onFoundFile}
                  />
                  {foundPreview && (
                    <div className="photo-actions">
                      <button type="button" className="photo-link" onClick={() => foundFileInput.current?.click()}>
                        Change
                      </button>
                      <button type="button" className="photo-link" onClick={removeFoundPhoto}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <FormError message={actionError} id="found-error" />

                <div className="il-claim-actions">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => { resetFound(); setActionError('') }}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="il-claim" disabled={busy}>
                    {busy ? 'Saving…' : 'Mark as Found'}
                  </button>
                </div>
              </form>
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
                  Name
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
                  Student number (optional)
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
                <label>
                  Proof of ownership
                  <textarea
                    name="proofOfOwnership"
                    rows={3}
                    maxLength={300}
                    value={claim.proofOfOwnership}
                    onChange={onClaimField}
                    placeholder="Describe something only the owner would know, such as what is inside, marks, or scratches"
                    aria-invalid={claimInvalid.proofOfOwnership ? 'true' : undefined}
                    aria-describedby={claimInvalid.proofOfOwnership ? 'claim-error' : undefined}
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