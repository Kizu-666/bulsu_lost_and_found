import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import './styles/TrendChart.css'

const SERIES = [
  { key: 'Found', color: '#f9710b' },
  { key: 'Lost', color: '#9eb1f6' },
  { key: 'Claimed', color: '#2b2118' },
]

const INK = 'rgba(43, 33, 24, 0.68)'

export default function TrendChart({ data }) {
  const hasData = data.some((m) => m.Found || m.Lost || m.Claimed)

  return (
    <section className="trend" aria-labelledby="trend-title">
      <h2 id="trend-title">Past six months</h2>
      <p className="trend-sub">Items posted and claimed each month.</p>

      {!hasData ? (
        <p className="trend-empty">No activity yet. Post an item to start the chart.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="rgba(43, 33, 24, 0.12)" />
              <XAxis
                dataKey="month" tickLine={false}
                axisLine={{ stroke: 'rgba(43, 33, 24, 0.3)' }}
                tick={{ fill: INK, fontSize: 13 }}
              />
              <YAxis
                allowDecimals={false} tickLine={false} axisLine={false}
                tick={{ fill: INK, fontSize: 13 }}
              />
              <Tooltip />
              <Legend
                iconType="circle"
                formatter={(value) => <span style={{ color: 'var(--text)' }}>{value}</span>}
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key} type="linear" dataKey={s.key}
                  stroke={s.color} strokeWidth={2.5}
                  dot={{ r: 4, fill: s.color, stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <details className="trend-table">
            <summary>View as table</summary>
            <table>
              <thead>
                <tr><th>Month</th><th>Found</th><th>Lost</th><th>Claimed</th></tr>
              </thead>
              <tbody>
                {data.map((m) => (
                  <tr key={m.key}>
                    <th scope="row">{m.month}</th>
                    <td>{m.Found}</td>
                    <td>{m.Lost}</td>
                    <td>{m.Claimed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  )
}