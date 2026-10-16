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
        <section className="hero">
          <div className="hero-copy">
            <h1>Lost something on campus? Check if it&rsquo;s here.</h1>
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

        <section className="claim" id="how-claiming-works">
          <div className="claim-inner">
            <h2>How claiming works</h2>
            <ol className="claim-steps">
              <li>
                <span className="claim-num">1</span>
                <h3>Find your item</h3>
                <p>Search the list by name, place, or date. Open an item to see its full details.</p>
              </li>
              <li>
                <span className="claim-num">2</span>
                <h3>Visit the CICT LSC</h3>
                <p>Bring your student ID to the LSC office and give the officer the item&rsquo;s ID number.</p>
              </li>
              <li>
                <span className="claim-num">3</span>
                <h3>Sign and take it home</h3>
                <p>The officer records your student number and hands the item over.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="handoff">
          <div className="handoff-inner">
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
            </address>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>CICT Lost and Found System</span>
          <span>Bulacan State University, Main Campus</span>
        </div>
      </footer>
    </>
  )
}