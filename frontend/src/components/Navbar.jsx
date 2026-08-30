import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSummarizer } from "../context/SummarizerContext";

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { resetForm } = useSummarizer();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimeout = useRef(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleNewSummary = (e) => {
    e.preventDefault();
    resetForm();
    navigate("/summarize");
  };

  const openMenu = () => {
    clearTimeout(closeTimeout.current);
    setMenuOpen(true);
  };

  const closeMenu = () => {
    closeTimeout.current = setTimeout(() => setMenuOpen(false), 200);
  };

  const initial = user?.full_name?.charAt(0)?.toUpperCase() || "U";

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand" onClick={handleNewSummary}>
          <span className="brand-mark">AI</span>
          <span className="brand-divider"></span>
          <span className="brand-text">
            <span>Content</span>
            <span>Summarizer</span>
          </span>
        </Link>

        {isAuthenticated ? (
          <div className="navbar-links">
            <Link to="/summarize" className="nav-link" onClick={handleNewSummary}>Summarize</Link>
            <div
              className="nav-avatar-wrap"
              onMouseEnter={openMenu}
              onMouseLeave={closeMenu}
            >
              <button className="nav-avatar">{initial}</button>
              {menuOpen && (
                <div className="nav-dropdown">
                  <Link to="/summaries" className="nav-dropdown-item" onClick={() => setMenuOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    My Summaries
                  </Link>
                  <Link to="/profile" className="nav-dropdown-item" onClick={() => setMenuOpen(false)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    Profile
                  </Link>
                  <div className="nav-dropdown-divider"></div>
                  <button className="nav-dropdown-item nav-dropdown-item--danger" onClick={handleLogout}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="navbar-links">
            <Link to="/login" className="nav-link">Sign in</Link>
            <Link to="/signup" className="btn-primary btn-sm">Get started</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
