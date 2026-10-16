export function formatShortDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''

  const thisYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: thisYear ? undefined : 'numeric',
  })
}