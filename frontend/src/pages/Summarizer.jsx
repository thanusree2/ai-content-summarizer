import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "../context/AuthContext";
import { useSummarizer, PROGRESS_STEPS } from "../context/SummarizerContext";
import AskSection from "../components/AskSection";

const MODES = [
  { id: "quick", label: "Quick", icon: "⚡", desc: "Fast bullet summary" },
  { id: "study", label: "Study", icon: "📚", desc: "Full study guide" },
  { id: "bullets", label: "Bullets", icon: "•", desc: "Point-form notes" },
  { id: "explain", label: "Simple", icon: "🧒", desc: "Beginner-friendly" },
  { id: "notes", label: "Notes", icon: "📝", desc: "Structured notes" },
  { id: "deep", label: "Deep Dive", icon: "🔍", desc: "In-depth analysis" },
];

export default function Summarizer() {
  const s = useSummarizer();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const fileInputRef = useRef(null);

  const copyResult = () => {
    if (!s.result) return;
    navigator.clipboard?.writeText(s.result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const wordCount = (text) => {
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  };

  const resultWords = wordCount(s.result);
  const reductionPct =
    s.sourceLength > 0 && resultWords > 0
      ? Math.max(0, Math.round((1 - (resultWords * 6) / Math.max(s.sourceLength / 5, 1)) * 100))
      : null;
  const resultReadMin = resultWords > 0 ? Math.max(1, Math.ceil(resultWords / 200)) : null;

  return (
    <div className="summarizer-page">
      <div className="summarizer-container">
        <header className="summarizer-header">
          <h1>New summary</h1>
          <p>Paste a URL, text, or upload a file — get smart insights in seconds.</p>
        </header>

        <div className="mode-selector">
          <span className="mode-selector-label">Summary mode</span>
          <div className="mode-cards">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`mode-card ${s.summaryMode === m.id ? "mode-card--active" : ""}`}
                onClick={() => s.setSummaryMode(m.id)}
              >
                <span className="mode-card-icon">{m.icon}</span>
                <span className="mode-card-label">{m.label}</span>
                <span className="mode-card-desc">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="workspace">
          <div className="input-panel">
            <div className="mode-tabs">
              <button
                className={`tab ${s.mode === "url" ? "tab-active" : ""}`}
                onClick={() => s.setMode("url")}
              >
                URL
              </button>
              <button
                className={`tab ${s.mode === "text" ? "tab-active" : ""}`}
                onClick={() => s.setMode("text")}
              >
                Paste text
              </button>
              <button
                className={`tab ${s.mode === "upload" ? "tab-active" : ""}`}
                onClick={() => s.setMode("upload")}
              >
                Upload file
              </button>
            </div>

            <form onSubmit={s.handleSubmit} className="workspace-form">
              {s.mode === "url" && (
                <div className="field">
                  <label htmlFor="source_url">Content URL</label>
                  <input
                    id="source_url"
                    name="source_url"
                    type="url"
                    placeholder="https://example.com/article"
                    value={s.form.source_url}
                    onChange={s.handleChange}
                  />
                </div>
              )}

              {s.mode === "text" && (
                <div className="field">
                  <label htmlFor="source_text">Content</label>
                  <textarea
                    id="source_text"
                    name="source_text"
                    placeholder="Paste the text you want summarized..."
                    value={s.form.source_text}
                    onChange={s.handleChange}
                    rows={10}
                  />
                </div>
              )}

              {s.mode === "upload" && (
                <div className="field">
                  <label>File</label>
                  <div
                    className={`drop-zone ${s.dragOver ? "drop-zone--over" : ""} ${s.selectedFile ? "drop-zone--selected" : ""}`}
                    onDrop={s.handleDrop}
                    onDragOver={s.handleDragOver}
                    onDragLeave={s.handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="drop-zone-input"
                      onChange={(e) => s.handleFileSelect(e.target.files[0])}
                    />
                    {s.selectedFile ? (
                      <>
                        <div className="drop-zone-icon">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10 9 9 9 8 9"/>
                          </svg>
                        </div>
                        <span className="drop-zone-name">{s.selectedFile.name}</span>
                        <span className="drop-zone-size">{(s.selectedFile.size / 1024).toFixed(0)} KB</span>
                        <span className="drop-zone-hint">Click to change file</span>
                      </>
                    ) : (
                      <>
                        <div className="drop-zone-icon">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                        </div>
                        <span className="drop-zone-text">Drop a file here or click to browse</span>
                        <span className="drop-zone-hint">PDF, DOCX, or TXT — max 10 MB</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="field">
                <label htmlFor="title">
                  Title <span className="label-optional">(optional)</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="Give it a name for your dashboard"
                  value={s.form.title}
                  onChange={s.handleChange}
                />
              </div>

              <div className="field">
                <label htmlFor="user_instruction">
                  Extra instructions <span className="label-optional">(optional)</span>
                </label>
                <textarea
                  id="user_instruction"
                  name="user_instruction"
                  placeholder="e.g. Focus on key findings, use bullet points, keep it under 200 words..."
                  value={s.form.user_instruction}
                  onChange={s.handleChange}
                  rows={3}
                />
              </div>

              {s.error && <div className="alert alert-error">{s.error}</div>}

              <button
                type="submit"
                className="btn-primary btn-full"
                disabled={s.loading}
              >
                {s.loading ? (
                  <span className="loading-dots">
                    Summarizing<span>.</span><span>.</span><span>.</span>
                  </span>
                ) : (
                  "Generate summary"
                )}
              </button>
            </form>
          </div>

          <div className={`result-panel ${s.result ? "result-panel--active" : ""}`}>
            {s.loading && (
              <div className="result-loading">
                <div className="pulse-ring"></div>
                <div className="progress-steps">
                  {PROGRESS_STEPS.map((step, i) => (
                    <div
                      key={step}
                      className={`progress-step ${
                        i < s.progressStep ? "progress-step--done" : i === s.progressStep ? "progress-step--active" : ""
                      }`}
                    >
                      {i < s.progressStep ? "✓" : i === s.progressStep ? "⏳" : "○"} {step}
                    </div>
                  ))}
                </div>
                <p className="result-loading-note">AI is reading your content…</p>
              </div>
            )}

            {!s.loading && !s.result && (
              <div className="result-empty">
                <div className="empty-icon">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <rect x="8" y="8" width="32" height="32" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
                    <line x1="14" y1="18" x2="34" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2"/>
                    <line x1="14" y1="24" x2="30" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2"/>
                    <line x1="14" y1="30" x2="26" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2"/>
                  </svg>
                </div>
                <p>Your summary will appear here</p>
                <span>Add content and hit generate to begin</span>
              </div>
            )}

            {!s.loading && s.result && (
              <div className="result-content">
                <div className="result-toolbar">
                  <div className="result-stats">
                    <span className="stat">
                      <strong>{resultWords}</strong> words
                    </span>
                    {reductionPct !== null && (
                      <span className="stat">
                        <strong>{reductionPct}%</strong> shorter
                      </span>
                    )}
                    {resultReadMin && (
                      <span className="stat">
                        <strong>{resultReadMin} min</strong> read
                      </span>
                    )}
                  </div>
                  <div className="result-actions">
                    <button className="btn-ghost btn-sm" onClick={copyResult} title="Copy summary">
                      {copied ? "Copied ✓" : "Copy"}
                    </button>
                    {!s.editing && (
                      <button className="btn-ghost btn-sm" onClick={s.startEditing}>
                        Edit
                      </button>
                    )}
                    {s.editing && (
                      <>
                        <button className="btn-ghost btn-sm" onClick={() => s.setEditing(false)}>
                          Cancel
                        </button>
                        <button
                          className="btn-primary btn-sm"
                          onClick={s.handleModify}
                          disabled={s.loading}
                        >
                          Apply edits
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {s.editing ? (
                  <textarea
                    className="edit-textarea"
                    value={s.editResult}
                    onChange={(e) => s.setEditResult(e.target.value)}
                    rows={20}
                  />
                ) : (
                  <div className="markdown-body">
                    <MarkdownRenderer content={s.result} />
                  </div>
                )}

                {!s.editing && (
                  <AskSection
                    chat={s.chat}
                    suggestions={s.suggestions}
                    chatQuestion={s.chatQuestion}
                    setChatQuestion={s.setChatQuestion}
                    chatLoading={s.chatLoading}
                    onAsk={s.handleAsk}
                    askSuggestion={s.askSuggestion}
                    userName={user?.full_name || ""}
                    error={s.error}
                    onSaveChat={s.saveChat}
                    chatSaved={s.chatSaved}
                  />
                )}

                {s.showSave && !s.editing && (
                  <div className="result-footer">
                    {s.saved ? (
                      <div className="result-footer-actions">
                        <button className="btn-primary" onClick={() => setShowSaveModal(true)}>
                          Update
                        </button>
                        <button className="btn-ghost" onClick={s.resetForm}>
                          Summarize something else
                        </button>
                      </div>
                    ) : (
                      <div className="result-footer-actions">
                        <button className="btn-primary" onClick={() => setShowSaveModal(true)}>
                          Save to dashboard
                        </button>
                        <button className="btn-ghost" onClick={s.resetForm}>
                          Summarize something else
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {showSaveModal && (
                  <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                      <h3 className="modal-title">{s.saved ? "Update summary" : "Save to dashboard"}</h3>
                      <label className="modal-label" htmlFor="modal-title">Title</label>
                      <input
                        id="modal-title"
                        className="modal-input"
                        type="text"
                        placeholder="Give it a name for your dashboard"
                        value={s.saveTitle}
                        onChange={(e) => s.setSaveTitle(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (s.saved) {
                              s.updateSummary();
                            } else {
                              s.saveSummary();
                            }
                            setShowSaveModal(false);
                          }
                        }}
                      />
                      <div className="modal-actions">
                        <button className="btn-ghost" onClick={() => setShowSaveModal(false)}>
                          Cancel
                        </button>
                        <button
                          className="btn-primary"
                          onClick={() => {
                            if (s.saved) {
                              s.updateSummary();
                            } else {
                              s.saveSummary();
                            }
                            setShowSaveModal(false);
                          }}
                          disabled={s.saving}
                        >
                          {s.saving ? "Saving…" : s.saved ? "Update" : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MarkdownRenderer({ content }) {
  return <ReactMarkdown>{content}</ReactMarkdown>;
}
