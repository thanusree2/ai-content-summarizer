import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { summaries } from "../api";
import ResumeBanner from "../components/ResumeBanner";
import BackButton from "../components/BackButton";

export default function Summaries() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(null);
  const [renameId, setRenameId] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    summaries
      .list()
      .then((res) => setItems(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(null);
      }
    };
    if (menuOpen !== null) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleDelete = async (id) => {
    try {
      await summaries.delete(id);
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch {
    }
  };

  const handleRename = async () => {
    if (!renameTitle.trim() || !renameId) return;
    setRenaming(true);
    try {
      const item = items.find((s) => s.id === renameId);
      const { data } = await summaries.modify(renameId, {
        result: item.result,
        title: renameTitle.trim(),
      });
      setItems((prev) => prev.map((s) => (s.id === renameId ? { ...s, title: data.title } : s)));
      setRenameId(null);
      setRenameTitle("");
    } catch {
    } finally {
      setRenaming(false);
    }
  };

  if (loading) {
    return (
      <div className="page-centered">
        <div className="pulse-ring"></div>
        <p>Loading summaries...</p>
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
          <div className="standalone-header-left">
            <div className="avatar avatar-sm">
              {authUser?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <h1>My Summaries</h1>
              <p className="standalone-sub">{items.length} summary{items.length !== 1 ? "ies" : ""} saved</p>
            </div>
          </div>
          <Link to="/summarize" className="btn-primary">
            + New summary
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <rect x="10" y="10" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
                <line x1="18" y1="22" x2="38" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.15"/>
                <line x1="18" y1="29" x2="34" y2="29" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.15"/>
                <line x1="18" y1="36" x2="30" y2="36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.15"/>
              </svg>
            </div>
            <h3>No summaries yet</h3>
            <p>Start by summarizing an article, paper, or any piece of content.</p>
            <Link to="/summarize" className="btn-primary">
              Summarize your first piece
            </Link>
          </div>
        ) : (
          <div className="summary-list">
            {items.map((item) => (
              <div key={item.id} className="summary-card">
                <div
                  className="summary-card-header"
                  onClick={() => navigate(`/summaries/${item.id}`)}
                >
                  <div className="summary-card-title">
                    <h3>{item.title}</h3>
                    <span className="summary-date">
                      {new Date(item.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="summary-card-meta">
                    {item.source_url && (
                      <span className="tag tag-url">URL</span>
                    )}
                    {item.user_instruction && (
                      <span className="tag tag-custom">Custom</span>
                    )}
                    <div className="card-actions" ref={menuOpen === item.id ? menuRef : undefined}>
                      <button
                        className="dots-btn"
                        title="More options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(menuOpen === item.id ? null : item.id);
                        }}
                      >
                        ⋮
                      </button>
                      {menuOpen === item.id && (
                        <div className="card-menu">
                          <button
                            className="card-menu-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameId(item.id);
                              setRenameTitle(item.title);
                              setMenuOpen(null);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            className="card-menu-item card-menu-item--danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                              setMenuOpen(null);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {renameId && (
        <div className="modal-overlay" onClick={() => setRenameId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rename summary</h3>
            <label className="modal-label" htmlFor="rename-title">Title</label>
            <input
              id="rename-title"
              className="modal-input"
              type="text"
              placeholder="Enter a new title"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenameId(null);
              }}
            />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setRenameId(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleRename}
                disabled={renaming || !renameTitle.trim()}
              >
                {renaming ? "Renaming…" : "Rename"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
