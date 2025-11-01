import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import "./Home.css";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => !!localStorage.getItem("token")
  );
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });
  const navigate = useNavigate();

  // Rotating tagline words for a more lively hero
  const taglines = useMemo(() => ["Find", "Reserve", "Navigate", "Park"], []);
  const [tagIndex, setTagIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTagIndex((i) => (i + 1) % taglines.length);
    }, 1800);
    return () => clearInterval(id);
  }, [taglines.length]);

  // Simple animated counters
  const [stats, setStats] = useState({ lots: 0, users: 0, bookings: 0 });
  useEffect(() => {
    const targets = { lots: 120, users: 3_200, bookings: 12_850 };
    const duration = 900; // ms
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setStats({
        lots: Math.floor(targets.lots * p),
        users: Math.floor(targets.users * p),
        bookings: Math.floor(targets.bookings * p),
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onStorage(e) {
      if (e.key === "token" || e.key === "user") {
        setIsLoggedIn(!!localStorage.getItem("token"));
        try {
          setUser(JSON.parse(localStorage.getItem("user") || "null"));
        } catch {
          setUser(null);
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const ctaTo = isLoggedIn ? "/dashboard" : "/login";
  const ctaText = isLoggedIn ? "Go to Dashboard" : "Get Started";
  const [search, setSearch] = useState("");
  const searchInputRef = useRef(null);

  function handleExplore() {
    // Navigate to dashboard; Dashboard already offers search there
    navigate("/dashboard");
  }

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          {isLoggedIn ? (
            <>
              <h2>Welcome back{user?.name ? `, ${user.name}` : "!"}</h2>
              <p>
                Jump into your dashboard to find spots near you or view your
                recent bookings.
              </p>
            </>
          ) : (
            <>
              <h2>
                <span className="fade-text">{taglines[tagIndex]}</span> your
                parking in seconds
              </h2>
              <p>
                Skip the hassle and find a spot instantly across malls,
                campuses, and public spaces.
              </p>
            </>
          )}
          <div className="hero-actions">
            <Link to={ctaTo} className="hero-cta">
              {ctaText}
            </Link>
            {isLoggedIn ? (
              <Link to="/booking-history" className="hero-cta alt">
                View History
              </Link>
            ) : (
              <button onClick={handleExplore} className="hero-cta alt">
                Explore Map
              </button>
            )}
          </div>
          {!isLoggedIn && (
            <div className="quick-search">
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search a city or place (opens map)"
              />
              <button onClick={handleExplore}>Open Map</button>
            </div>
          )}
        </div>
      </section>
      <section className="stats">
        <div className="stat">
          <div className="num">{stats.lots.toLocaleString()}</div>
          <div className="label">Parking lots</div>
        </div>
        <div className="stat">
          <div className="num">{stats.users.toLocaleString()}+</div>
          <div className="label">Happy users</div>
        </div>
        <div className="stat">
          <div className="num">{stats.bookings.toLocaleString()}</div>
          <div className="label">Bookings</div>
        </div>
      </section>

      <section className="features">
        <h3>Why ParkEasy?</h3>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="ico">⚡</div>
            <h4>Instant search</h4>
            <p>Find the nearest available lots with live availability.</p>
          </div>
          <div className="feature-card">
            <div className="ico">🗺️</div>
            <h4>Satellite map</h4>
            <p>See landmarks clearly and navigate with one tap.</p>
          </div>
          <div className="feature-card">
            <div className="ico">🔒</div>
            <h4>Secure</h4>
            <p>Your account and bookings are protected with JWT.</p>
          </div>
          <div className="feature-card">
            <div className="ico">⏱️</div>
            <h4>Real-time refresh</h4>
            <p>Auto-updates keep availability fresh without reloads.</p>
          </div>
        </div>
      </section>

      <section className="how">
        <h3>How it works</h3>
        <div className="steps">
          <div className="step">
            <div className="badge">1</div>
            <h4>Search</h4>
            <p>Open the map and search a place or use your location.</p>
          </div>
          <div className="step">
            <div className="badge">2</div>
            <h4>Choose</h4>
            <p>Compare nearby lots by distance and availability.</p>
          </div>
          <div className="step">
            <div className="badge">3</div>
            <h4>Book</h4>
            <p>Reserve a slot and get instant directions in Google Maps.</p>
          </div>
        </div>
      </section>

      <section className="testimonials">
        <h3>What drivers say</h3>
        <div className="quotes">
          <blockquote>
            “Found parking at the mall in seconds. The directions button is
            gold.”
            <footer>— Aditi • Ahmedabad</footer>
          </blockquote>
          <blockquote>
            “Clean UI and live updates. Booking is super fast.”
            <footer>— Rohan • Gandhinagar</footer>
          </blockquote>
        </div>
      </section>

      <section className="faq">
        <h3>FAQs</h3>
        <details>
          <summary>Is ParkEasy free to use?</summary>
          <p>
            Yes, searching lots and navigating is free. Booking may carry
            lot-specific fees.
          </p>
        </details>
        <details>
          <summary>Do I need location access?</summary>
          <p>No, you can search any place. Location just makes it faster.</p>
        </details>
        <details>
          <summary>Which maps are used?</summary>
          <p>
            We use a satellite basemap and open Google Maps for turn-by-turn
            directions.
          </p>
        </details>
      </section>
    </div>
  );
}
