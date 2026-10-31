import { useId, useRef, useState } from 'react'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { uploadImage, optimizedUrl } from '../utils/uploadImage'
import './styles/Profile.css'

const EMPTY_FORM = { current: '', next: '', confirm: '' }

function passwordError(code) {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Your current password is incorrect.'
    case 'auth/weak-password':
      return 'The new password is too weak. Use at least 6 characters.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/requires-recent-login':
      return 'Please log out and log in again, then retry.'
    default:
      return 'Could not change the password. Please try again.'
  }
}

function PasswordField({ label, value, onChange, autoComplete, minLength }) {
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
          minLength={minLength}
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
              <path d="M3 3l18 18" />
              <path d="M10.6 5.1A9.8 9.8 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6A16.6 16.6 0 002 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1" />
              <path d="M9.9 9.9a3 3 0 004.2 4.2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
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

  const [photo, setPhoto] = useState(user?.photoURL || '')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')

  const [showPw, setShowPw] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwDone, setPwDone] = useState(false)

  const name = user?.displayName || 'LSC Admin'

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoError('')
    setPhotoBusy(true)
    try {
      const url = await uploadImage(file)
      await updateProfile(user, { photoURL: url })
      setPhoto(url)
    } catch (err) {
      setPhotoError(err.message || 'Could not update the photo.')
    } finally {
      setPhotoBusy(false)
    }
  }

  function openPw() {
    setForm(EMPTY_FORM)
    setPwError('')
    setPwDone(false)
    setShowPw(true)
  }

  function closePw() {
    if (!pwBusy) setShowPw(false)
  }

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handlePassword(e) {
    e.preventDefault()
    setPwError('')

    if (form.next.length < 6) return setPwError('The new password must be at least 6 characters.')
    if (form.next !== form.confirm) return setPwError('The new passwords do not match.')
    if (form.next === form.current) return setPwError('The new password must be different from the current one.')

    setPwBusy(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, form.current)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, form.next)
      setPwDone(true)
    } catch (err) {
      console.error('Change password failed:', err)
      setPwError(passwordError(err.code))
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
                onChange={handlePhoto}
                hidden
              />
            </div>

            <h2 className="profile-name">{name}</h2>
            <p className="profile-role">Administrator</p>
            {photoBusy && <p className="profile-note">Uploading photo…</p>}
            {photoError && <p className="profile-error" role="alert">{photoError}</p>}
          </div>

          {/* Right: details */}
          <div className="profile-details">
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

      {/* Change password modal */}
      <Modal open={showPw} onClose={closePw}>
        {pwDone ? (
          <div className="profile-pw">
            <h2>Password updated</h2>
            <p className="profile-pw-text">Your password was changed successfully.</p>
            <div className="profile-pw-actions">
              <button type="button" className="btn-primary" onClick={() => setShowPw(false)}>Done</button>
            </div>
          </div>
        ) : (
          <form className="profile-pw" onSubmit={handlePassword}>
            <h2>Change password</h2>
            <p className="profile-pw-text">Enter your current password, then choose a new one.</p>

            <PasswordField
              label="Current password"
              value={form.current}
              onChange={setField('current')}
              autoComplete="current-password"
            />
            <PasswordField
              label="New password"
              value={form.next}
              onChange={setField('next')}
              autoComplete="new-password"
              minLength={6}
            />
            <PasswordField
              label="Confirm new password"
              value={form.confirm}
              onChange={setField('confirm')}
              autoComplete="new-password"
              minLength={6}
            />

            {pwError && <p className="profile-error" role="alert">{pwError}</p>}

            <div className="profile-pw-actions">
              <button type="button" className="btn-outline" onClick={closePw} disabled={pwBusy}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={pwBusy}>
                {pwBusy ? 'Saving…' : 'Save password'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  )
}