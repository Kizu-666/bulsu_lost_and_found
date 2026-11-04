import { useState, useEffect, useRef } from 'react'
import { ref, push, set, serverTimestamp } from 'firebase/database'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { uploadImage, validateImage } from '../utils/uploadImage'
import { LOCATIONS } from '../constants/locations'
import './styles/PostItem.css'
import SelectMenu from '../components/SelectMenu'
import { STUDENT_NO, PH_MOBILE, cleanStudentNo, cleanPhone } from '../utils/validators'

const emptyForm = {
  name: '', description: '', day: '', time: '', place: '', customPlace: '',
  finderName: '', finderStudentId: '', finderContact: '',
  lostByName: '', lostByStudentId: '', lostByContact: '',
}
const PLACE_OPTIONS = LOCATIONS.map((p) => ({ value: p, label: p }))

function makeItemId() {
  const year = new Date().getFullYear()
  const code = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `CICT-${year}-${code}`
}

function nowParts() {
  const iso = nowLocal() // "2026-11-03T14:05"
  return { today: iso.slice(0, 10), nowTime: iso.slice(11, 16) }
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
  const [openMenu, setOpenMenu] = useState(null) // null | 'place'
  const { today, nowTime } = nowParts()

  /* Tabbing out of an open dropdown closes it */
  useEffect(() => {
    if (!openMenu) return undefined
    const closeIfOutside = (e) => {
      if (!e.target.closest?.('.il-dropdown.is-open')) setOpenMenu(null)
    }
    document.addEventListener('focusin', closeIfOutside)
    return () => document.removeEventListener('focusin', closeIfOutside)
  }, [openMenu])

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
  const handlePlaceChange = (value) =>
    setForm((f) => ({ ...f, place: value, customPlace: '' }))

  const handleFinderChange = (e) => {
    const { name } = e.target
    let value = e.target.value
    if (name === 'finderStudentId' || name === 'lostByStudentId') value = cleanStudentNo(value)
    if (name === 'finderContact' || name === 'lostByContact') value = cleanPhone(value)
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (isFound && !file) {
      setError('Add a photo of the found item.')
      return
    }

    if (!form.place) {
      setError(isFound ? 'Select where the item was found.' : 'Select where the item was lost.')
      return
    }

    if (form.place === 'Others' && !form.customPlace.trim()) {
      setError('Enter the specific location.')
      return
    }

    if (isFound) {
      if (!form.finderName.trim()) {
        setError('Enter the name of the person who turned in the item.')
        return
      }
      if (form.finderStudentId && !STUDENT_NO.test(form.finderStudentId)) {
        setError('The student number must be 10 digits (e.g. 2020100450).')
        return
      }
      if (!form.finderContact) {
        setError('Enter the contact number of the person who turned in the item.')
        return
      }
      if (!PH_MOBILE.test(form.finderContact)) {
        setError('The contact number must be 11 digits starting with 09 (e.g. 09123456789).')
        return
      }
    }

    if (!isFound) {
      if (!form.lostByName.trim()) {
        setError('Enter the name of the person who lost the item.')
        return
      }
      if (form.lostByStudentId && !STUDENT_NO.test(form.lostByStudentId)) {
        setError('The student number must be 10 digits (e.g. 2020100450), or leave it blank.')
        return
      }
      if (!form.lostByContact) {
        setError('Enter the contact number of the person who lost the item.')
        return
      }
      if (!PH_MOBILE.test(form.lostByContact)) {
        setError('The contact number must be 11 digits starting with 09 (e.g. 09123456789).')
        return
      }
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
          date: `${form.day}T${form.time}`,
          place: form.place === 'Others' ? form.customPlace.trim() : form.place,
          placeCategory: form.place,
          ...(isFound
            ? {
                turnedInBy: {
                  name: form.finderName.trim(),
                  contactNumber: form.finderContact,
                  ...(form.finderStudentId ? { studentId: form.finderStudentId } : {}),
                },
              }
            : {}),
          ...(!isFound
            ? {
                lostBy: {
                  name: form.lostByName.trim(),
                  contactNumber: form.lostByContact,
                  ...(form.lostByStudentId ? { studentId: form.lostByStudentId } : {}),
                },
              }
            : {}),
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
        <span className="post-label" id="item-when-label">
          {isFound ? 'When found' : 'When lost'} <span className="required">*</span>
        </span>
        <div className="post-when" role="group" aria-labelledby="item-when-label">
          <input
            id="item-day" type="date" name="day" aria-label="Date"
            max={today} value={form.day} onChange={handleChange} required
          />
          <input
            id="item-time" type="time" name="time" aria-label="Time"
            max={form.day === today ? nowTime : undefined}
            value={form.time} onChange={handleChange} required
          />
        </div>
      </div>

      <div className="post-field">
        <label htmlFor="item-place">{isFound ? 'Where found' : 'Where lost'} <span className='required'>*</span></label>
        {openMenu && <div className="il-backdrop" aria-hidden="true" onClick={() => setOpenMenu(null)} />}
        <SelectMenu
          id="place"
          buttonId="item-place"
          ariaLabel="Location"
          value={form.place}
          options={PLACE_OPTIONS}
          placeholder="Select location"
          onChange={handlePlaceChange}
          open={openMenu === 'place'}
          setOpen={setOpenMenu}
        />
        {form.place === 'Others' && (
          <input
            className="post-custom-place"
            name="customPlace"
            maxLength={80}
            value={form.customPlace}
            onChange={handleChange}
            aria-label="Specific location"
            placeholder="Enter specific location"
            required
          />
        )}
      </div>
      {isFound && (
        <section className="post-section" aria-labelledby="finder-heading">
          <h3 id="finder-heading">Turned in by</h3>

          <div className="post-field">
            <label htmlFor="finder-name">Name <span className="required">*</span></label>
            <input
              id="finder-name" name="finderName" maxLength={80}
              value={form.finderName} onChange={handleChange}
              autoComplete="off" required
              placeholder="e.g. Juan Dela Cruz"
            />
          </div>

          <div className="post-field">
            <label htmlFor="finder-student">Student number (optional)</label>
            <input
              id="finder-student" name="finderStudentId"
              value={form.finderStudentId} onChange={handleFinderChange}
              inputMode="numeric" maxLength={10} autoComplete="off"
              placeholder="e.g. 2020100450"
            />
          </div>

          <div className="post-field">
            <label htmlFor="finder-contact">Contact number <span className="required">*</span></label>
            <input
              id="finder-contact" name="finderContact" type="tel"
              value={form.finderContact} onChange={handleFinderChange}
              inputMode="numeric" maxLength={11} autoComplete="off" required
              placeholder="e.g. 09123456789"
            />
          </div>
        </section>
      )}
      {!isFound && (
        <section className="post-section" aria-labelledby="lostby-heading">
          <h3 id="lostby-heading">Lost by</h3>

          <div className="post-field">
            <label htmlFor="lostby-name">Name <span className="required">*</span></label>
            <input
              id="lostby-name" name="lostByName" maxLength={80}
              value={form.lostByName} onChange={handleChange}
              autoComplete="off" required
              placeholder="e.g. Juan Dela Cruz"
            />
          </div>

          <div className="post-field">
            <label htmlFor="lostby-student">Student number (optional)</label>
            <input
              id="lostby-student" name="lostByStudentId"
              value={form.lostByStudentId} onChange={handleFinderChange}
              inputMode="numeric" maxLength={10} autoComplete="off"
              placeholder="e.g. 2020100450"
            />
          </div>

          <div className="post-field">
            <label htmlFor="lostby-contact">Contact number <span className="required">*</span></label>
            <input
              id="lostby-contact" name="lostByContact" type="tel"
              value={form.lostByContact} onChange={handleFinderChange}
              inputMode="numeric" maxLength={11} autoComplete="off" required
              placeholder="e.g. 09123456789"
            />
          </div>
        </section>
      )}
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