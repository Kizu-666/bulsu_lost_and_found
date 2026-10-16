import { useState, useEffect, useRef } from 'react'
import { ref, push, set, serverTimestamp } from 'firebase/database'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { uploadImage, validateImage } from '../utils/uploadImage'
import './styles/PostItem.css'

const emptyForm = { name: '', description: '', date: '', place: '' }

function makeItemId() {
  const year = new Date().getFullYear()
  const code = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `CICT-${year}-${code}`
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })), ms)
    ),
  ])
}

function postErrorMessage(err) {
  if (err?.code === 'PERMISSION_DENIED') {
    return 'Your account does not have permission to post items.'
  }
  if (err?.code === 'TIMEOUT') {
    return 'The server is taking too long to respond. Check your internet connection, then try again.'
  }
  return 'Something went wrong while saving. Check your internet connection, then try again.'
}

function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function PostItem({ onDone, onResult }) {
  const { user } = useAuth()
  const [status, setStatus] = useState('found')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isFound = status === 'found'

  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const fileInput = useRef(null)
  const [photoError, setPhotoError] = useState('')

  const draft = useRef(null)
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const handleFile = (e) => {
    const picked = e.target.files[0]
    if (!picked) return

    const problem = validateImage(picked)
    if (problem) {
      setPhotoError(problem)
      e.target.value = ''
      return
    }

    setPhotoError('')
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
    e.target.value = ''
  }

  const removePhoto = () => {
    setFile(null)
    setPreview('')
    setPhotoError('')
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (isFound && !file) {
      setError('Add a photo of the found item.')
      return
    }

    setSaving(true)

    let imageUrl = ''
    if (file) {
      try {
        imageUrl = await uploadImage(file)
      } catch (err) {
        onResult?.({ ok: false, message: err.message })
        setSaving(false)
        return
      }
    }

    try {
      if (!draft.current) {
        draft.current = { ref: push(ref(db, 'items')), itemId: makeItemId() }
      }

      await withTimeout(
        set(draft.current.ref, {
          itemId: draft.current.itemId,
          type: status,
          name: form.name.trim(),
          description: form.description.trim(),
          status,
          date: form.date,
          place: form.place.trim(),
          imageUrl,
          postedBy: user.uid,
          createdAt: serverTimestamp(),
        }),
        10000
      )

      const posted = { name: form.name.trim(), itemId: draft.current.itemId }
      draft.current = null
      setForm(emptyForm)
      onResult?.({ ok: true, ...posted })
    } catch (err) {
      console.error(err)
      onResult?.({ ok: false, message: postErrorMessage(err) })
    }

    setSaving(false)
  }

  return (
    <form className="post" onSubmit={handleSubmit}>
      <h2>Post an item</h2>
      <p className="post-sub">Record an item that was turned in or reported lost.</p>

      <div className="post-kind" role="group" aria-label="Item type">
        <button
          type="button"
          className={`post-kind-btn ${isFound ? 'is-active' : ''}`}
          aria-pressed={isFound}
          onClick={() => setStatus('found')}
        >
          Found item
        </button>
        <button
          type="button"
          className={`post-kind-btn ${!isFound ? 'is-active' : ''}`}
          aria-pressed={!isFound}
          onClick={() => setStatus('lost')}
        >
          Lost item
        </button>
      </div>

      <div className="post-field">
        <label htmlFor="item-name">Item name <span className='required'>*</span></label>
        <input
          id="item-name" name="name" maxLength={80}
          value={form.name} onChange={handleChange} required
          placeholder="e.g. Black umbrella"
        />
      </div>

      <div className="post-field">
        <label htmlFor="item-description">Description <span className='required'>*</span></label>
        <textarea
          id="item-description" name="description" rows={3}
          value={form.description} onChange={handleChange} required
          placeholder="Color, brand, markings, or anything that helps identify it"
        />
      </div>

      <div className="post-field">
        <label htmlFor="item-date">{isFound ? 'When found' : 'When lost'} <span className='required'>*</span></label>
        <input
          id="item-date" type="datetime-local" name="date" max={nowLocal()}
          value={form.date} onChange={handleChange} required
        />
      </div>

      <div className="post-field">
        <label htmlFor="item-place">{isFound ? 'Where found' : 'Where lost'} <span className='required'>*</span></label>
        <input
          id="item-place" name="place" maxLength={80}
          value={form.place} onChange={handleChange} required
          placeholder="e.g. Room 301"
        />
      </div>

      <div className="post-field">
        <span className="post-label">Photo{isFound ? <span className='required'> *</span> : ' (optional)'}</span>

        <div className={`photo-box ${preview ? 'has-image' : ''}`}>
          {preview ? (
            <img src={preview} alt="Selected item preview" className="photo-img" />
          ) : (
            <button
              type="button" className="photo-empty"
              onClick={() => fileInput.current.click()}
            >
              <span className="photo-empty-title">Choose a photo</span>
              <span className="photo-empty-hint">JPG, PNG, or WebP, up to 5 MB</span>
            </button>
          )}
        </div>

        <input
          ref={fileInput} type="file" hidden
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
        />

        {preview && (
          <div className="photo-actions">
            <button type="button" className="photo-link" onClick={() => fileInput.current.click()}>
              Change
            </button>
            <button type="button" className="photo-link" onClick={removePhoto}>
              Remove
            </button>
          </div>
        )}

        {photoError && <p className="post-error" role="alert">{photoError}</p>}
      </div>

      {error && <p className="post-error" role="alert">{error}</p>}

      <div className="post-actions">
        <button type="button" className="btn-outline" onClick={() => onDone?.()}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Posting…' : 'Post item'}
        </button>
      </div>
    </form>
  )
}