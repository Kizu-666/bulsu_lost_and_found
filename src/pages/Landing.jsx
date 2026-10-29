import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import useItems from '../hooks/useItems'
import { formatShortDate } from '../utils/formatDate'
import ItemPhoto from '../components/ItemPhoto'
import './styles/Landing.css'

const lsc = {
  name: 'CICT LSC Office',
  place: '[Building, floor, and room number]',
  hours: '[Days and office hours]',
}

export default function Landing() {
  const { items, loading } = useItems()

  const latest = items
    .filter((item) => item.status !== 'claimed')
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, 3)
  return (
    <>
      <Navbar />

      <main>
        <div className="hero-bleed">
          <section className="hero">
            <div className="hero-copy">
              <span className="hero-badge">CICT Lost &amp; Found</span>
              <h1>
                Lost something<br />on campus?
                <span className="hero-accent">Check if it&rsquo;s here.</span>
              </h1>
              <p className="hero-text">
                Browse the items turned in to the CICT Lost and Found. Spot yours,
                then claim it at the LSC office with your student ID.
              </p>
              <div className="hero-actions">
                <Link to="/browse" className="btn-primary hero-btn">Browse items</Link>
                <a href="#how-claiming-works" className="hero-link">How claiming works</a>
              </div>
            </div>

            <div className="hero-tags" aria-label="Latest items">
              {!loading && latest.length === 0 && (
                <article className="tag tag-1">
                  <span className="tag-hole" aria-hidden="true" />
                  <h3 className="tag-name">No items yet</h3>
                  <p className="tag-empty">Items posted by the CICT LSC will appear here.</p>
                </article>
              )}

              {latest.map((item, i) => (
                <article key={item.key} className={`tag tag-${i + 1}`}>
                  <span className="tag-hole" aria-hidden="true" />

                  <div className="tag-head">
                    <span className={`tag-status tag-status-${item.status}`}>
                      {item.status === 'found' ? 'Found' : 'Lost'}
                    </span>
                    <ItemPhoto src={item.imageUrl} width={120} className="tag-photo" />
                  </div>

                  <h3 className="tag-name">{item.name}</h3>
                  <dl className="tag-meta">
                    <div><dt>Where</dt><dd>{item.place}</dd></div>
                    <div><dt>When</dt><dd>{formatShortDate(item.date)}</dd></div>
                  </dl>
                  <p className="tag-id">{item.itemId}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="claim" id="how-claiming-works">
          <div className="claim-inner">
            <h2>How claiming works</h2>
            <p className="claim-sub">It&rsquo;s quick and easy. Just follow these steps:</p>
            <ol className="claim-steps">
              <li>
                <span className="claim-num">1</span>
                <span className="claim-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                </span>
                <h3>Find your item</h3>
                <p>Search the list by name, place, or date. Open an item to see its full details.</p>
              </li>
              <li>
                <span className="claim-num">2</span>
                <span className="claim-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <circle cx="9" cy="11" r="2" />
                    <path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14.5 10h3.5M14.5 14h3.5" />
                  </svg>
                </span>
                <h3>Visit the CICT LSC</h3>
                <p>Bring your student ID to the LSC office and give the officer the item&rsquo;s ID number.</p>
              </li>
              <li>
                <span className="claim-num">3</span>
                <span className="claim-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 11L12 3.5 20.5 11" />
                    <path d="M5.5 9.5V20h4.5v-6h4v6h4.5V9.5" />
                  </svg>
                </span>
                <h3>Sign and take it home</h3>
                <p>The officer records your student number and hands the item over.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="handoff">
          <div className="handoff-inner">
            <span className="handoff-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="30" height="30">
                <path
                  fill="currentColor"
                  d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
                />
              </svg>
            </span>

            <div>
              <h2>Found something that isn&rsquo;t yours?</h2>
              <p>Hand it to the CICT LSC. An officer will post it here so its owner can find it.</p>
            </div>

            <address className="handoff-location">
              <svg className="handoff-pin" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
                />
              </svg>
              <div className="handoff-details">
                <strong>{lsc.name}</strong>
                <span>{lsc.place}</span>
                <span>{lsc.hours}</span>
              </div>
              <svg className="handoff-chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </address>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>CICT Lost and Found System</span>
          <span>
            <svg className="footer-pin" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
              />
            </svg>
            Bulacan State University, Main Campus
          </span>
        </div>
      </footer>
    </>
  )
}