import { useEffect, useRef } from 'react'

/* One dropdown shell: same button, same arrow, same open color.
   Only one dropdown on a page should be open at a time (the page owns that state). */
export function Dropdown({
  id, buttonId, label, open, setOpen, btnRef,
  btnClassName = '', popup = 'true', className = '', onButtonKeyDown, children,
}) {
  const close = () => {
    setOpen(null)
    btnRef.current?.focus()
  }
  return (
    <div className={`il-dropdown ${className}${open ? ' is-open' : ''}`}>
      <button
        ref={btnRef}
        id={buttonId}
        type="button"
        className={`il-dropdown-btn${btnClassName ? ` ${btnClassName}` : ''}`}
        aria-haspopup={popup}
        aria-expanded={open}
        aria-controls={open ? `il-menu-${id}` : undefined}
        onClick={() => setOpen(open ? null : id)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation() // don't let a surrounding Modal close too
            setOpen(null)
          }
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
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation() // don't let a surrounding Modal close too
              close()
            }
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/* Custom list (keyboard: arrows, Home/End, Enter/Space, Esc) */
export default function SelectMenu({
  id, buttonId, value, options, onChange, ariaLabel, placeholder, open, setOpen,
}) {
  const btnRef = useRef(null)
  const listRef = useRef(null)
  const current = options.find((o) => o.value === value)
  const showPlaceholder = !current && !!placeholder
  const label = current?.label ?? (placeholder || options[0]?.label)

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
      buttonId={buttonId}
      label={label}
      open={open}
      setOpen={setOpen}
      btnRef={btnRef}
      btnClassName={showPlaceholder ? 'is-placeholder' : ''}
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