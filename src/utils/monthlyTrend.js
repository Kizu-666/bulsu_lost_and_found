const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function buildTrend(items, monthsBack = 6) {
  const now = new Date()
  const buckets = []

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: MONTHS[d.getMonth()],
      Found: 0,
      Lost: 0,
      Claimed: 0,
    })
  }

  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]))
  const keyOf = (ms) => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${d.getMonth()}`
  }

  items.forEach((item) => {
    const type = item.type ?? item.status

    if (typeof item.createdAt === 'number') {
      const bucket = byKey[keyOf(item.createdAt)]
      if (bucket && type === 'found') bucket.Found += 1
      if (bucket && type === 'lost') bucket.Lost += 1
    }

    const claimedAt = item.claim?.claimedAt
    if (typeof claimedAt === 'number') {
      const bucket = byKey[keyOf(claimedAt)]
      if (bucket) bucket.Claimed += 1
    }
  })

  return buckets
}