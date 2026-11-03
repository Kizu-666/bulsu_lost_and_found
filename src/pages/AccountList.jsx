import { useEffect, useMemo, useState } from 'react'
import { ref, set, update, serverTimestamp } from 'firebase/database'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import useAccounts from '../hooks/useAccounts'
import { createLoginAccount, sendSetupEmail } from '../utils/createLoginAccount'
import Modal from '../components/Modal'
import FormError from '../components/FormError'
import Toast from '../components/Toast'
import './styles/ItemListing.css'
import './styles/AccountList.css'
import SelectMenu from '../components/SelectMenu'

const EMPTY_FORM = { name: '', email: '', role: 'officer' }
const ROLES = [
  { value: 'officer', label: 'LSC Officer' },
  { value: 'admin', label: 'Administrator' },
]
const roleLabel = (role) => ROLES.find((r) => r.value === role)?.label ?? 'LSC Officer'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAGE_SIZE = 6 // pager shows only when accounts exceed this
const plural = (n) => (n > 1 ? 's' : '')
const FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

function addErrorMessage(err) {
  switch (err?.code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists.'
    case 'auth/invalid-email': return 'Enter a valid email address.'
    case 'auth/weak-password': return 'The password is too weak. Use at least 8 characters.'
    case 'auth/network-request-failed': return 'Cannot reach the server. Check your internet connection.'
    case 'PERMISSION_DENIED': return 'Your account does not have permission to add accounts.'
    default: return 'Could not create the account. Try again.'
  }
}

const BlockIcon = () => (
  <svg viewBox="0 0 24 24" className="il-ico" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M5.6 5.6l12.8 12.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export default function AccountList() {
  const { user } = useAuth()
  const { accounts, loading, error } = useAccounts()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [invalid, setInvalid] = useState({})
  const [formError, setFormError] = useState([])
  const [target, setTarget] = useState(null) // single account being deactivated or reactivated
  const [selectedUids, setSelectedUids] = useState(new Set())
  const [confirmBulk, setConfirmBulk] = useState(null) // null | 'deactivate' | 'reactivate'
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [openMenu, setOpenMenu] = useState(null) // null | 'status' | 'role'

  /* Tabbing out of an open dropdown closes it */
  useEffect(() => {
    if (!openMenu) return undefined
    const closeIfOutside = (e) => {
      if (!e.target.closest?.('.il-dropdown.is-open')) setOpenMenu(null)
    }
    document.addEventListener('focusin', closeIfOutside)
    document.addEventListener('pointerdown', closeIfOutside)
    return () => {
      document.removeEventListener('focusin', closeIfOutside)
      document.removeEventListener('pointerdown', closeIfOutside)
    }
  }, [openMenu])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return accounts
      .filter((a) => {
        const isActive = a.active !== false
        if (status === 'active' && !isActive) return false
        if (status === 'inactive' && isActive) return false
        return !q || [a.name, a.email].filter(Boolean).some((f) => f.toLowerCase().includes(q))
      })
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }, [accounts, query, status])

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageItems = list.slice(start, start + PAGE_SIZE)
  const showPager = list.length > PAGE_SIZE

  /* Selection: one status at a time. The first account you tick decides whether
     you're deactivating (active accounts) or reactivating (inactive accounts). */
  const selectedAccounts = useMemo(
    () => accounts.filter((a) => selectedUids.has(a.uid) && a.uid !== user?.uid),
    [accounts, selectedUids, user?.uid]
  )
  const selected = selectedAccounts
  const selectionMode = selectedAccounts.length
    ? (selectedAccounts[0].active === false ? 'reactivate' : 'deactivate')
    : null
  const bulkTargets = selectedAccounts

  const matchesMode = (a, mode) => (a.active === false) === (mode === 'reactivate')
  const isSelectable = (a) =>
    a.uid !== user?.uid && (selectionMode === null || matchesMode(a, selectionMode))

  const selectablePage = (() => {
    if (selectionMode) return pageItems.filter(isSelectable)
    // nothing selected yet: "select all" picks the active accounts, or the inactive ones if none are active
    const others = pageItems.filter((a) => a.uid !== user?.uid)
    const active = others.filter((a) => a.active !== false)
    return active.length ? active : others
  })()

  const allOnPageSelected =
    selectablePage.length > 0 && selectablePage.every((a) => selectedUids.has(a.uid))

  const toggleOne = (uid) =>
    setSelectedUids((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })

  const toggleAllOnPage = () =>
    setSelectedUids((prev) => {
      const next = new Set(prev)
      selectablePage.forEach((a) => (allOnPageSelected ? next.delete(a.uid) : next.add(a.uid)))
      return next
    })

  const selectAllCheckbox = (
    <input
      type="checkbox"
      checked={allOnPageSelected}
      disabled={selectablePage.length === 0}
      onChange={toggleAllOnPage}
      aria-label="Select all accounts on this page"
    />
  )

  const onSearch = (e) => {
    setQuery(e.target.value)
    setPage(1)
  }

  const clearFilters = () => {
    setQuery('')
    setStatus('all')
    setPage(1)
  }
  const hasFilters = query || status !== 'all'

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setInvalid({})
    setFormError([])
    setOpenMenu(null)
    setAdding(true)
  }

  const closeAdd = () => {
    if (busy) return
    setOpenMenu(null)
    setAdding(false)
  }

  const onField = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setInvalid((prev) => (prev[name] ? { ...prev, [name]: false } : prev))
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    const email = form.email.trim().toLowerCase()

    const errors = {}
    if (!name) errors.name = 'Enter the officer’s name.'
    if (!email) errors.email = 'Enter the email address.'
    else if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.'

    if (Object.keys(errors).length > 0) {
      setInvalid(Object.fromEntries(Object.keys(errors).map((k) => [k, true])))
      setFormError(Object.values(errors))
      return
    }

    setBusy(true)
    setInvalid({})
    setFormError([])

    try {
      const uid = await createLoginAccount(email)
      await set(ref(db, `users/${uid}`), {
        name, email, role: form.role === 'admin' ? 'admin' : 'officer', active: true, createdAt: serverTimestamp(),
      })
    } catch (err) {
      console.error(err)
      if (err?.code === 'auth/email-already-in-use' || err?.code === 'auth/invalid-email') {
        setInvalid({ email: true })
      }
      setFormError([addErrorMessage(err)])
      setBusy(false)
      return
    }

    // The account exists now, so close the form whatever happens with the email
    setAdding(false)
    try {
      await sendSetupEmail(email)
      setNotice(`Account added. A password setup email was sent to ${email}.`)
    } catch (err) {
      console.error(err)
      setNotice('Account added, but the setup email could not be sent.')
    }
    setBusy(false)
  }

  /* ---------- Deactivate / reactivate (single, from the row button) ---------- */
  const openToggle = (account) => {
    setActionError('')
    setTarget(account)
  }

  const handleToggle = async () => {
    if (!target) return
    const makeActive = target.active === false
    setBusy(true)
    setActionError('')
    try {
      await update(ref(db, `users/${target.uid}`), { active: makeActive })
      setNotice(makeActive ? 'Account reactivated.' : 'Account deactivated.')
      setTarget(null)
    } catch (err) {
      console.error(err)
      setActionError(
        err?.code === 'PERMISSION_DENIED'
          ? 'Your account does not have permission to change accounts.'
          : 'Could not update the account. Try again.'
      )
    }
    setBusy(false)
  }

  /* ---------- Deactivate / reactivate (bulk, from the checkboxes) ---------- */
  const openBulk = (mode) => {
    setActionError('')
    setConfirmBulk(mode)
  }

  const handleBulk = async () => {
    const makeActive = confirmBulk === 'reactivate'
    const count = bulkTargets.length
    if (count === 0) return
    setBusy(true)
    setActionError('')
    try {
      const updates = {}
      bulkTargets.forEach((a) => { updates[`users/${a.uid}/active`] = makeActive })
      await update(ref(db), updates)
      // keep the other accounts selected, drop only the ones just changed
      setSelectedUids((prev) => {
        const next = new Set(prev)
        bulkTargets.forEach((a) => next.delete(a.uid))
        return next
      })
      setConfirmBulk(null)
      setNotice(`${count} account${plural(count)} ${makeActive ? 'reactivated' : 'deactivated'}.`)
    } catch (err) {
      console.error(err)
      setActionError(
        err?.code === 'PERMISSION_DENIED'
          ? 'Your account does not have permission to change accounts.'
          : 'Could not update the accounts. Try again.'
      )
    }
    setBusy(false)
  }

  const reactivating = target?.active === false

  return (
    <div className="il">
      <main className="il-main">
        <div className="il-head">
          <h1>Account List</h1>
          <button type="button" className="il-add" onClick={openAdd}>
            <svg viewBox="0 0 24 24" className="il-ico" aria-hidden="true">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            Add Account
          </button>
        </div>
        <p className="il-sub">Manage the officer accounts that can sign in to the admin pages.</p>

        <div className="il-controls">
          <label className="il-search">
            <svg viewBox="0 0 24 24" className="il-ico" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path d="M16.5 16.5L21 21" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={onSearch}
              placeholder="Search by name or email..."
              aria-label="Search accounts"
            />
          </label>
          {openMenu === 'status' && <div className="il-backdrop" aria-hidden="true" onClick={() => setOpenMenu(null)} />}

          <SelectMenu
            id="status"
            ariaLabel="Filter by status"
            value={status}
            options={FILTERS}
            onChange={(v) => { setStatus(v); setPage(1) }}
            open={openMenu === 'status'}
            setOpen={setOpenMenu}
          />

          {hasFilters && (
            <button type="button" className="il-clear" onClick={clearFilters}>Clear</button>
          )}
        </div>

        {error && <p className="il-state il-state-error" role="alert">{error}</p>}

        <section className="il-card" aria-label="Accounts">
          <div className="il-toolbar">
            <label className="il-selectall">{selectAllCheckbox} All</label>

            {selected.length > 0 ? (
              <>
                <span className="il-selected">
                  {selected.length} account{plural(selected.length)} selected
                </span>
                {selectionMode === 'reactivate' ? (
                  <button
                    type="button"
                    className="il-claim al-bulk-btn il-remove-right"
                    onClick={() => openBulk('reactivate')}
                  >
                    Reactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    className="il-remove il-remove-right"
                    onClick={() => openBulk('deactivate')}
                  >
                    <BlockIcon /> Deactivate
                  </button>
                )}
              </>
            ) : (
              <span className="il-hint">Select accounts to deactivate or reactivate them.</span>
            )}
          </div>

          <div className="il-scroll">
            <table className="il-table">
              <thead>
                <tr>
                  <th className="il-col-check">{selectAllCheckbox}</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Date Added</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((a) => {
                  const isSelf = a.uid === user?.uid
                  const isActive = a.active !== false
                  const selectable = isSelectable(a)
                  const isSel = selectedUids.has(a.uid)
                  return (
                    <tr key={a.uid} className={isSel ? 'is-selected' : ''}>
                      <td className="il-col-check">
                        <input
                          type="checkbox"
                          checked={isSel}
                          disabled={!selectable}
                          onChange={() => toggleOne(a.uid)}
                          title={!selectable && !isSelf ? 'Select accounts with the same status only' : undefined}
                          aria-label={`Select ${a.name || a.email}`}
                        />
                      </td>
                      <td data-label="Name">
                        <span className="il-name-text-plain">
                          {a.name || '—'}
                          {isSelf && <span className="al-you">You</span>}
                        </span>
                      </td>
                      <td data-label="Email">{a.email || '—'}</td>
                      <td data-label="Role">{roleLabel(a.role)}</td>
                      <td data-label="Status">
                        <span className={`il-pill ${isActive ? 'il-pill-active' : 'il-pill-inactive'}`}>
                          <i aria-hidden="true" /> {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td data-label="Date Added">{formatDate(a.createdAt)}</td>
                      <td className="il-cell-action">
                        {isSelf ? (
                          <span className="al-self">Your account</span>
                        ) : (
                          <button
                            type="button"
                            className={`il-view${isActive ? ' al-danger' : ''}`}
                            onClick={() => openToggle(a)}
                          >
                            {isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {loading && <p className="il-state">Loading accounts…</p>}
          {!loading && !error && list.length === 0 && (
            <p className="il-state">
              {accounts.length === 0 ? 'No accounts yet.' : 'No accounts match your search.'}
            </p>
          )}
        </section>

        {/* Count + pager */}
        {list.length > 0 && (
          <div className="il-footer">
            <span className="il-count">
              Showing {start + 1}–{Math.min(start + PAGE_SIZE, list.length)} of {list.length} account{plural(list.length)}
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

      {/* Add account */}
      <Modal open={adding} onClose={closeAdd}>
        <form className="il-claim-form" onSubmit={handleAdd} noValidate>
          <h2 className="al-form-title">Add Account</h2>
          <p className="al-form-sub">Create a sign-in for a new CICT LSC officer. A link to set their password will be emailed to them.</p>

          <label>
            Name
            <input
              name="name" value={form.name} onChange={onField}
              autoComplete="off" maxLength={80} placeholder="e.g. Juan Dela Cruz"
              aria-invalid={invalid.name ? 'true' : undefined}
              aria-describedby={formError.length ? 'account-error' : undefined}
              required
            />
          </label>
          <label>
            Email
            <input
              name="email" type="email" value={form.email} onChange={onField}
              autoComplete="off" placeholder="officer@example.com"
              aria-invalid={invalid.email ? 'true' : undefined}
              aria-describedby={formError.length ? 'account-error' : undefined}
              required
            />
          </label>
          <div className="al-field">
            <span>Role</span>
            <SelectMenu
              id="role"
              ariaLabel="Role"
              value={form.role}
              options={ROLES}
              onChange={(v) => setForm((prev) => ({ ...prev, role: v }))}
              open={openMenu === 'role'}
              setOpen={setOpenMenu}
            />
          </div>
          <p className="al-role-hint">
            {form.role === 'admin'
              ? 'Administrators can also add, deactivate and reactivate accounts.'
              : 'LSC officers can manage items but cannot manage accounts.'}
          </p>

          <FormError message={formError} id="account-error" />

          <div className="il-claim-actions">
            <button type="button" className="btn-outline" onClick={closeAdd} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="il-claim" disabled={busy}>
              {busy ? 'Creating…' : 'Add Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm deactivate / reactivate (single) */}
      <Modal open={!!target} onClose={() => !busy && setTarget(null)}>
        {target && (
          <div className="il-confirm">
            <h2>{reactivating ? 'Reactivate' : 'Deactivate'} this account?</h2>
            <p>
              {reactivating
                ? `${target.name || target.email} will be able to sign in and manage items again.`
                : `${target.name || target.email} will no longer be able to sign in or manage items. You can reactivate the account later.`}
            </p>
            <FormError message={actionError} />
            <div className="il-confirm-actions">
              <button type="button" className="btn-outline" onClick={() => setTarget(null)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className={reactivating ? 'il-claim al-confirm-btn' : 'il-remove'}
                onClick={handleToggle}
                disabled={busy}
              >
                {busy ? 'Saving…' : reactivating ? 'Reactivate' : 'Deactivate'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm deactivate / reactivate (bulk) */}
      <Modal open={!!confirmBulk} onClose={() => !busy && setConfirmBulk(null)}>
        <div className="il-confirm">
          <h2>
            {confirmBulk === 'reactivate' ? 'Reactivate' : 'Deactivate'} {bulkTargets.length} account{plural(bulkTargets.length)}?
          </h2>
          <p>
            {confirmBulk === 'reactivate'
              ? `The selected account${plural(bulkTargets.length)} will be able to sign in and manage items again.`
              : `The selected account${plural(bulkTargets.length)} will no longer be able to sign in or manage items. You can reactivate ${bulkTargets.length > 1 ? 'them' : 'it'} later.`}
          </p>
          <FormError message={actionError} />
          <div className="il-confirm-actions">
            <button type="button" className="btn-outline" onClick={() => setConfirmBulk(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={confirmBulk === 'reactivate' ? 'il-claim al-confirm-btn' : 'il-remove'}
              onClick={handleBulk}
              disabled={busy}
            >
              {busy ? 'Saving…' : confirmBulk === 'reactivate' ? 'Reactivate' : 'Deactivate'}
            </button>
          </div>
        </div>
      </Modal>

      <Toast notice={notice} onClose={() => setNotice('')} />
    </div>
  )
}