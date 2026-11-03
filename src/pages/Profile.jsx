import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import { ref, onValue, set } from 'firebase/database'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import FormError from '../components/FormError'
import { uploadImage, optimizedUrl, validateImage } from '../utils/uploadImage'
import './styles/Profile.css'
import Toast from '../components/Toast'

const EMPTY_FORM = { current: '', next: '', confirm: '' }

function passwordError(code) {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return { field: 'current', message: 'Your current password is incorrect.' }
    case 'auth/weak-password':
      return { field: 'next', message: 'The new password is too weak. Use at least 6 characters.' }
    case 'auth/too-many-requests':
      return { message: 'Too many attempts. Please wait a moment and try again.' }
    case 'auth/requires-recent-login':
      return { message: 'Please log out and log in again, then retry.' }
    default:
      return { message: 'Could not change the password. Please try again.' }
  }
}

function PasswordField({ label, value, onChange, autoComplete, invalid, describedBy }) {
  const id = useId()
  const [show, setShow] = useState(false)

  return (
    <div className="profile-pw-group">
      <label htmlFor={id}>{label}</label>
      <div className="profile-pw-field">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={invalid ? describedBy : undefined}
          required
        />
        <button
          type="button"
          className="profile-pw-eye"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          {show ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 3l18 18" />
              <path d="M10.6 5.1A9.8 9.8 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6A16.6 16.6 0 002 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1" />
              <path d="M9.9 9.9a3 3 0 004.2 4.2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export default function Profile() {
  const { user } = useAuth()
  const fileInput = useRef(null)

  /* Account record (name) from the database */
  const [account, setAccount] = useState(null)
  useEffect(() => {
    if (!user) return undefined
    return onValue(
      ref(db, `users/${user.uid}`),
      (snap) => setAccount(snap.val()),
      (err) => console.error('Could not load the account:', err)
    )
  }, [user])

  const [photo, setPhoto] = useState(user?.photoURL || '')
  const [pending, setPending] = useState(null) // { file, preview } waiting for Save or Cancel
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('') // problem with the chosen file
  const [saveError, setSaveError] = useState([]) // problem while saving, shown in the popup
  const [notice, setNotice] = useState('')
  const closeNotice = useCallback(() => setNotice(''), [])

  useEffect(() => {
    return () => {
      if (pending?.preview) URL.revokeObjectURL(pending.preview)
    }
  }, [pending])

  /* Edit name */
  const [showName, setShowName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [nameBusy, setNameBusy] = useState(false)
  const [nameError, setNameError] = useState([])
  const [nameInvalid, setNameInvalid] = useState(false)

  /* Change password */
  const [showPw, setShowPw] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState([])
  const [pwInvalid, setPwInvalid] = useState({})

  const name = account?.name || user?.displayName || 'LSC Officer'

  function handlePick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const problem = validateImage(file)
    if (problem) {
      setPhotoError(problem)
      return
    }

    setPhotoError('')
    setSaveError([])
    setPending({ file, preview: URL.createObjectURL(file) })
  }

  function cancelPhoto() {
    if (!photoBusy) setPending(null)
  }

  async function savePhoto() {
    if (!pending) return
    setPhotoBusy(true)
    setSaveError([])
    try {
      const url = await uploadImage(pending.file)
      await updateProfile(user, { photoURL: url })
      setPhoto(url)
      setPending(null)
      setNotice('Profile photo updated.')
    } catch (err) {
      console.error('Photo upload failed:', err)
      setSaveError([err.message || 'Could not update the photo. Please try again.'])
    } finally {
      setPhotoBusy(false)
    }
  }

  /* ---------- Name ---------- */
  function openName() {
    setNameValue(account?.name || user?.displayName || '')
    setNameError([])
    setNameInvalid(false)
    setShowName(true)
  }

  function closeName() {
    if (!nameBusy) setShowName(false)
  }

  async function handleName(e) {
    e.preventDefault()
    const value = nameValue.trim()

    if (!value) {
      setNameInvalid(true)
      setNameError(['Enter your name.'])
      return
    }

    setNameBusy(true)
    setNameError([])
    setNameInvalid(false)
    try {
      await set(ref(db, `users/${user.uid}/name`), value)
      setShowName(false)
      setNotice("Name updated.")
    } catch (err) {
      console.error('Save name failed:', err)
      setNameError([
        err?.code === 'PERMISSION_DENIED'
          ? 'Your account does not have permission to change the name.'
          : 'Could not save the name. Please try again.',
      ])
    } finally {
      setNameBusy(false)
    }
  }

  /* ---------- Password ---------- */
  function openPw() {
    setForm(EMPTY_FORM)
    setPwError([])
    setPwInvalid({})
    setShowPw(true)
  }

  function closePw() {
    if (!pwBusy) setShowPw(false)
  }

  const setField = (key) => (e) => {
    const { value } = e.target
    setForm((f) => ({ ...f, [key]: value }))
    setPwInvalid((p) => (p[key] ? { ...p, [key]: false } : p))
  }

  async function handlePassword(e) {
    e.preventDefault()
    setPwError([])
    setPwInvalid({})

    // 1 to 3: checks that cost nothing, all shown together
    const errors = {}
    if (!form.current) errors.current = 'Enter your current password.'

    if (!form.next) errors.next = 'Enter a new password.'
    else if (form.next.length < 6) errors.next = 'The new password must be at least 6 characters.'

    if (!form.confirm) errors.confirm = 'Confirm your new password.'
    else if (form.next && form.confirm !== form.next) errors.confirm = 'The new passwords do not match.'

    if (Object.keys(errors).length > 0) {
      setPwInvalid(Object.fromEntries(Object.keys(errors).map((k) => [k, true])))
      setPwError(Object.values(errors))
      return
    }

    setPwBusy(true)
    try {
      // 4: is the current password correct? (asks Firebase)
      const credential = EmailAuthProvider.credential(user.email, form.current)
      await reauthenticateWithCredential(user, credential)

      // 5: only meaningful once the current password is confirmed
      if (form.next === form.current) {
        setPwInvalid({ next: true })
        setPwError(['The new password must be different from the current one.'])
        return
      }

      await updatePassword(user, form.next)
      setShowPw(false)
      setNotice('Password updated.')
    } catch (err) {
      console.error('Change password failed:', err)
      const { field, message } = passwordError(err.code)
      if (field) setPwInvalid({ [field]: true })
      setPwError([message])
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <main className="profile">
      <div className="profile-main">
        <h1>Profile</h1>
        <p className="profile-sub">Manage your account details.</p>

        <section className="profile-card">
          {/* Left: avatar */}
          <div className="profile-who">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {photo ? (
                  <img src={optimizedUrl(photo, 300)} alt="" />
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" />
                  </svg>
                )}
              </div>

              <button
                type="button"
                className="profile-camera"
                aria-label="Change profile photo"
                onClick={() => fileInput.current?.click()}
                disabled={photoBusy}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 4l-1.5 2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-2.5L15 4H9zm3 4.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9zm0 2a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" />
                </svg>
              </button>

              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePick}
                hidden
              />
            </div>

            <h2 className="profile-name">{name}</h2>
            <p className="profile-role">Administrator</p>
            {photoError && <p className="profile-error" role="alert">{photoError}</p>}
          </div>

          {/* Right: details */}
          <div className="profile-details">
            <button type="button" className="profile-row profile-row-action" onClick={openName}>
              <span className="profile-row-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" />
                </svg>
              </span>
              <div className="profile-row-text">
                <span className="profile-row-label">Full Name</span>
                <span className="profile-row-value">{name}</span>
              </div>
              <svg className="profile-chevron" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="profile-row">
              <span className="profile-row-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 6.5A2.5 2.5 0 015.5 4h13A2.5 2.5 0 0121 6.5v11a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17.5v-11zm2.2.3L12 12.2l6.8-5.4H5.2z" />
                </svg>
              </span>
              <div className="profile-row-text">
                <span className="profile-row-label">Email Address</span>
                <span className="profile-row-value">{user?.email}</span>
              </div>
            </div>

            <button type="button" className="profile-row profile-row-action" onClick={openPw}>
              <span className="profile-row-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M7 10V8a5 5 0 0110 0v2h1a1 1 0 011 1v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9a1 1 0 011-1h1zm2 0h6V8a3 3 0 00-6 0v2zm3 4a1.5 1.5 0 00-.75 2.8V18h1.5v-1.2A1.5 1.5 0 0012 14z" />
                </svg>
              </span>
              <div className="profile-row-text">
                <span className="profile-row-title">Change Password</span>
                <span className="profile-row-label">Update your password for better security.</span>
              </div>
              <svg className="profile-chevron" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </section>
      </div>

      {/* Edit name modal */}
      <Modal open={showName} onClose={closeName}>
        <form className="profile-pw" onSubmit={handleName} noValidate>
          <h2>Edit name</h2>
          <p className="profile-pw-text">This is the name shown on your profile and in the account list.</p>

          <div className="profile-pw-group">
            <label htmlFor="profile-name-input">Full name</label>
            <input
              id="profile-name-input"
              value={nameValue}
              onChange={(e) => {
                setNameValue(e.target.value)
                setNameInvalid(false)
              }}
              maxLength={80}
              autoComplete="name"
              placeholder="e.g. Juan Dela Cruz"
              aria-invalid={nameInvalid ? 'true' : undefined}
              aria-describedby={nameInvalid ? 'name-error' : undefined}
              required
            />
          </div>

          <FormError message={nameError} id="name-error" />

          <div className="profile-pw-actions">
            <button type="button" className="btn-outline" onClick={closeName} disabled={nameBusy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={nameBusy}>
              {nameBusy ? 'Saving…' : 'Save name'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Change password modal */}
      <Modal open={showPw} onClose={closePw}>
        <form className="profile-pw" onSubmit={handlePassword} noValidate>
          <h2>Change password</h2>
          <p className="profile-pw-text">Enter your current password, then choose a new one.</p>

          <PasswordField
            label="Current password"
            value={form.current}
            onChange={setField('current')}
            autoComplete="current-password"
            invalid={pwInvalid.current}
            describedBy="pw-error"
          />
          <PasswordField
            label="New password"
            value={form.next}
            onChange={setField('next')}
            autoComplete="new-password"
            invalid={pwInvalid.next}
            describedBy="pw-error"
          />
          <PasswordField
            label="Confirm new password"
            value={form.confirm}
            onChange={setField('confirm')}
            autoComplete="new-password"
            invalid={pwInvalid.confirm}
            describedBy="pw-error"
          />

          <FormError message={pwError} id="pw-error" />

          <div className="profile-pw-actions">
            <button type="button" className="btn-outline" onClick={closePw} disabled={pwBusy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={pwBusy}>
              {pwBusy ? 'Saving…' : 'Save password'}
            </button>
          </div>
        </form>
      </Modal>
      {/* Photo preview modal */}
      <Modal open={!!pending} onClose={cancelPhoto}>
        {pending && (
          <div className="profile-pw">
            <h2>Change profile photo</h2>
            <p className="profile-pw-text">This is how your new photo will look. Save it to keep the change.</p>

            <div className="profile-photo-preview">
              <img src={pending.preview} alt="Preview of the new profile photo" />
            </div>

            <FormError message={saveError} id="photo-error" />

            <div className="profile-pw-actions">
              <button type="button" className="btn-outline" onClick={cancelPhoto} disabled={photoBusy}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={savePhoto} disabled={photoBusy}>
                {photoBusy ? 'Saving…' : 'Save photo'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Toast notice={notice} onClose={closeNotice} />
    </main>
  )
}