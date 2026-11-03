import { useMemo, useState } from 'react'
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

const EMPTY_FORM = { name: '', email: '' }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

export default function AccountList() {
  const { user } = useAuth()
  const { accounts, loading, error } = useAccounts()

  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [invalid, setInvalid] = useState({})
  const [formError, setFormError] = useState([])
  const [target, setTarget] = useState(null) // account being deactivated or reactivated
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return accounts
      .filter((a) => !q || [a.name, a.email].filter(Boolean).some((f) => f.toLowerCase().includes(q)))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  }, [accounts, query])

  /* ---------- Add account ---------- */
  const openAdd = () => {
    setForm(EMPTY_FORM)
    setInvalid({})
    setFormError([])
    setAdding(true)
  }
  const closeAdd = () => !busy && setAdding(false)

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
        name, email, role: 'admin', active: true, createdAt: serverTimestamp(),
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

  /* ---------- Deactivate / reactivate ---------- */
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email..."
              aria-label="Search accounts"
            />
          </label>
        </div>

        {error && <p className="il-state il-state-error" role="alert">{error}</p>}

        <section className="il-card" aria-label="Accounts">
          <div className="il-scroll">
            <table className="il-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Date Added</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => {
                  const isSelf = a.uid === user?.uid
                  const isActive = a.active !== false
                  return (
                    <tr key={a.uid}>
                      <td data-label="Name">
                        <span className="il-name-text-plain">
                          {a.name || '—'}
                          {isSelf && <span className="al-you">You</span>}
                        </span>
                      </td>
                      <td data-label="Email">{a.email || '—'}</td>
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

        {list.length > 0 && (
          <div className="il-footer">
            <span className="il-count">
              {list.length} account{list.length > 1 ? 's' : ''}
            </span>
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

      {/* Confirm deactivate / reactivate */}
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

      <Toast notice={notice} onClose={() => setNotice('')} />
    </div>
  )
}