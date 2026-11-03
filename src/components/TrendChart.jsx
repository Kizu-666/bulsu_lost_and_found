import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import './styles/TrendChart.css'

const SERIES = [
  { key: 'Found', color: 'var(--status-found)', dash: undefined },
  { key: 'Lost', color: 'var(--status-lost)', dash: '7 5' }, // dashed, so it differs without color
  { key: 'Claimed', color: 'var(--status-claimed)', dash: undefined },
]

const INK = 'rgba(43, 33, 24, 0.68)'

export default function TrendChart({ data }) {
  const hasData = data.some((m) => m.Found || m.Lost || m.Claimed)

  return (
    <section className="trend" aria-labelledby="trend-title">
      <div className="trend-head">
        <span className="trend-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
            strokeWidth="2.4" strokeLinecap="round" focusable="false">
            <path d="M5 20V10M12 20V4M19 20v-7" />
          </svg>
        </span>
        <div>
          <h2 id="trend-title">Past six months</h2>
          <p className="trend-sub">Items posted and claimed each month.</p>
        </div>
      </div>

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
              <Tooltip
                cursor={{ stroke: 'rgba(43, 33, 24, 0.25)' }}
                contentStyle={{
                  border: 'none', borderRadius: 14,
                  boxShadow: '0 8px 24px rgba(43, 33, 24, 0.18)', padding: '0.5rem 0.75rem',
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Legend
                iconType="circle"
                formatter={(value) => <span style={{ color: 'var(--text)' }}>{value}</span>}
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key} type="linear" dataKey={s.key}
                  stroke={s.color} strokeWidth={3.5} strokeDasharray={s.dash}
                  dot={{ r: 5, fill: s.color, stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: s.color, stroke: '#2b2118', strokeWidth: 2 }}
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