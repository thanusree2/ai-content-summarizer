import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useAuth } from "../context/AuthContext";
import { summaries, chats } from "../api";
import AskSection from "../components/AskSection";

export default function SummaryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSaved, setChatSaved] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    summaries
      .get(id)
      .then((res) => setItem(res.data))
      .catch(() => setError("Summary not found"))
      .finally(() => setLoading(false));

    summaries
      .suggestions(id)
      .then((res) => setSuggestions(res.data.questions || []))
      .catch(() => setSuggestions([]));

    chats
      .load(id)
      .then((res) => {
        if (res.data && res.data.messages && res.data.messages.length > 0) {
          setChat(res.data.messages);
          setChatSaved(true);
        }
      })
      .catch(() => {});
  }, [id]);

  const handleAsk = async () => {
    if (!chatQuestion.trim()) return;
    const q = chatQuestion.trim();
    const hasError = error && error.includes("Failed to get an answer");
    if (hasError) setError("");
    setChatQuestion("");
    setChat((prev) => [...prev, { q, a: "" }]);
    setChatLoading(true);
    setChatSaved(false);
    try {
      const history = chat.map((t) => ({ q: t.q, a: t.a }));
      const { data } = await summaries.ask(id, q, history, item?.mode);
      setChat((prev) => {
        const next = [...prev];
        next[next.length - 1].a = data.answer;
        return next;
      });
      // Fetch new suggestions based on updated conversation
      summaries
        .suggestions(id)
        .then((res) => setSuggestions(res.data.questions || []))
        .catch(() => {});
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to get an answer");
      setChat((prev) => prev.slice(0, -1));
      setChatQuestion(q);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSaveChat = async () => {
    if (chat.length === 0) return;
    try {
      await chats.save(id, chat);
      setChatSaved(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save chat");
    }
  };

  const askSuggestion = (s) => setChatQuestion(s);

  const copyResult = () => {
    if (!item?.result) return;
    navigator.clipboard?.writeText(item.result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await summaries.delete(id);
      navigate("/summaries");
    } catch {
      setError("Failed to delete");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-centered">
        <div className="pulse-ring"></div>
        <p>Loading summary...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="standalone-page">
        <div className="standalone-container">
          <div className="empty-state">
            <h3>{error || "Summary not found"}</h3>
            <Link to="/summaries" className="btn-primary">
              Back to summaries
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="standalone-page">
      <div className="standalone-container standalone-container--wide">
        <div className="detail-header">
          <button className="btn-ghost btn-sm" onClick={() => navigate("/summaries")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back
          </button>
          <div className="detail-header-actions">
            <button className="btn-ghost btn-sm" onClick={copyResult} title="Copy summary">
              {copied ? "Copied ✓" : "Copy"}
            </button>
            {confirmDelete ? (
              <div className="delete-confirm-inline">
                <span className="delete-confirm-text">Delete?</span>
                <button
                  className="btn-danger btn-xs"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "..." : "Yes"}
                </button>
                <button
                  className="btn-ghost btn-xs"
                  onClick={() => setConfirmDelete(false)}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                className="btn-ghost btn-sm btn-danger-ghost"
                onClick={() => setConfirmDelete(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Delete
              </button>
            )}
          </div>
        </div>

        <article className="detail-card">
          <header className="detail-card-header">
            <h1>{item.title}</h1>
            <div className="detail-meta">
              <span className="detail-date">
                {new Date(item.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="detail-source-link"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  View source
                </a>
              )}
            </div>
            {item.user_instruction && (
              <div className="detail-instruction">
                <span className="source-label">Your instruction</span>
                <p>{item.user_instruction}</p>
              </div>
            )}
          </header>

          <div className="detail-body">
            <div className="markdown-body">
              <ReactMarkdown>{item.result}</ReactMarkdown>
            </div>

            <AskSection
              chat={chat}
              suggestions={suggestions}
              chatQuestion={chatQuestion}
              setChatQuestion={setChatQuestion}
              chatLoading={chatLoading}
              onAsk={handleAsk}
              askSuggestion={askSuggestion}
              userName={user?.full_name || ""}
              error={error}
              onSaveChat={handleSaveChat}
              chatSaved={chatSaved}
            />
          </div>
        </article>
      </div>
    </div>
  );
}
