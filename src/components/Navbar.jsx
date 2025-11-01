// Navigation bar component for ParkEasy app
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./Navbar.css";

export default function Navbar() {
  // Reactive auth state (updates instantly on logout/login, also across tabs)
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onStorage(e) {
      if (e.key === "token" || e.key === "user" || e.key === "auth:tick") {
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
  const navigate = useNavigate();

  // Handle user logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // Bump a version to notify other tabs/listeners
    try {
      localStorage.setItem("auth:tick", String(Date.now()));
    } catch (e) {
      void e;
    }
    // Update local state immediately so UI reacts in this tab
    setIsLoggedIn(false);
    setUser(null);
    setMenuOpen(false);
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">🚗 ParkEasy</div>
      <button
        className="menu-toggle"
        aria-label="Open menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 6h18M3 12h18M3 18h18"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <ul className="navbar-links desktop">
        {/* Always show Home link */}
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/about">About</Link>
        </li>
        {/* Show Login/Register if not logged in */}
        {!isLoggedIn && (
          <>
            <li>
              <Link to="/login">Login</Link>
            </li>
            <li>
              <Link to="/register">Register</Link>
            </li>
          </>
        )}
        {/* Show dashboard, history, owner links, and logout if logged in */}
        {isLoggedIn && (
          <>
            <li>
              <Link to="/dashboard">Dashboard</Link>
            </li>
            <li>
              <Link to="/booking-history">History</Link>
            </li>
            <li>
              {/* Show Add Parking if owner, else Become Owner */}
              {user?.role === "owner" ? (
                <Link to="/owner/register">Add Parking</Link>
              ) : (
                <Link to="/owner/register">Become Owner</Link>
              )}
            </li>
            <li>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </li>
          </>
        )}
      </ul>
      {menuOpen && (
        <div className="mobile-menu" onClick={() => setMenuOpen(false)}>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/about">About</Link>
            </li>
            {!isLoggedIn && (
              <>
                <li>
                  <Link to="/login">Login</Link>
                </li>
                <li>
                  <Link to="/register">Register</Link>
                </li>
              </>
            )}
            {isLoggedIn && (
              <>
                <li>
                  <Link to="/dashboard">Dashboard</Link>
                </li>
                <li>
                  <Link to="/booking-history">History</Link>
                </li>
                <li>
                  {user?.role === "owner" ? (
                    <Link to="/owner/register">Add Parking</Link>
                  ) : (
                    <Link to="/owner/register">Become Owner</Link>
                  )}
                </li>
                <li>
                  <button onClick={handleLogout} className="logout-btn">
                    Logout
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </nav>
  );
}
