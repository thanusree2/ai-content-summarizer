import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { user, summaries } from "../api";
import ResumeBanner from "../components/ResumeBanner";
import BackButton from "../components/BackButton";

export default function Profile() {
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState(null);
  const [summaryCount, setSummaryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([user.me(), summaries.list()])
      .then(([profileRes, summariesRes]) => {
        setProfile(profileRes.data);
        setSummaryCount(summariesRes.data.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-centered">
        <div className="pulse-ring"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="standalone-page">
      <div className="standalone-container">
        <ResumeBanner />
        <div className="page-back-row">
          <BackButton />
        </div>
        <div className="standalone-header">
          <h1>Your profile</h1>
        </div>

        {profile && (
          <div className="profile-card">
            <div className="profile-avatar-row">
              <div className="avatar avatar-lg">
                {profile.full_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div>
                <h2 className="profile-name">{profile.full_name}</h2>
                <p className="profile-email">{profile.email}</p>
              </div>
            </div>

            <div className="profile-divider"></div>

            <div className="profile-grid">
              <div className="profile-field">
                <span className="profile-label">Name</span>
                <span className="profile-value">{profile.full_name}</span>
              </div>
              <div className="profile-field">
                <span className="profile-label">Email</span>
                <span className="profile-value">{profile.email}</span>
              </div>
              <div className="profile-field">
                <span className="profile-label">Member since</span>
                <span className="profile-value">
                  {new Date(profile.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="profile-field">
                <span className="profile-label">Total summaries</span>
                <span className="profile-value">{summaryCount}</span>
              </div>
            </div>

            <div className="profile-divider"></div>

            <div className="profile-field">
              <span className="profile-label">Appearance</span>
              <div className="theme-toggle-row">
                <span className="theme-toggle-label">
                  {theme === "dark" ? "Dark mode" : "Light mode"}
                </span>
                <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                  <span className={`theme-toggle-track ${theme === "light" ? "theme-toggle-track--light" : ""}`}>
                    <span className="theme-toggle-thumb">
                      {theme === "dark" ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="5"/>
                          <line x1="12" y1="1" x2="12" y2="3"/>
                          <line x1="12" y1="21" x2="12" y2="23"/>
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                          <line x1="1" y1="12" x2="3" y2="12"/>
                          <line x1="21" y1="12" x2="23" y2="12"/>
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                      )}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
