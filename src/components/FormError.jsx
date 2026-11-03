import './styles/FormError.css'

export default function FormError({ message, id }) {
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