import { useState, useEffect } from 'react'
import { optimizedUrl } from '../utils/uploadImage'
import './styles/ItemPhoto.css'

export default function ItemPhoto({
  src,
  alt = '',
  width = 600,        // size Cloudinary should deliver
  fit = 'cover',      // 'cover' fills the box, 'contain' shows the whole photo
  showLabel = false,  // adds "No photo provided" under the icon
  className = '',
}) {
  const [failed, setFailed] = useState(false)

  // Try again if the item (and its photo link) changes
  useEffect(() => setFailed(false), [src])

  const showImage = src && !failed

  return (
    <div className={`item-photo ${className}`} data-fit={fit}>
      {showImage ? (
        <img
          src={optimizedUrl(src, width)}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="item-photo-empty" aria-hidden="true">
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5" />
          </svg>
          {showLabel && <span>No photo provided</span>}
        </div>
      )}
    </div>
  )
}