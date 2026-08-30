import ReactMarkdown from "react-markdown";

export default function AskSection({
  chat,
  suggestions,
  chatQuestion,
  setChatQuestion,
  chatLoading,
  onAsk,
  askSuggestion,
  userName,
  error,
  onSaveChat,
  chatSaved,
}) {
  const hasThread = chat && chat.length > 0;
  const firstInitial = userName ? userName.charAt(0).toUpperCase() : "U";

  return (
    <div className="ask-section">
      <div className="ask-section-head">
        <span className="ask-section-title">💬 Ask about your content</span>
      </div>

      <div className="chat-thread">
        {!hasThread && (
          <p className="chat-empty">
            Ask a question to dig deeper into the main ideas of this content.
          </p>
        )}

        {hasThread &&
          chat.map((turn, i) => (
            <div className="chat-turn" key={i}>
              <div className="chat-row chat-row--user">
                <div className="chat-avatar chat-avatar--user">{firstInitial}</div>
                <div className="chat-bubble chat-bubble--user">{turn.q}</div>
              </div>
              {turn.a ? (
                <div className="chat-row chat-row--ai">
                  <div className="chat-avatar chat-avatar--ai">AI</div>
                  <div className="chat-bubble chat-bubble--ai">
                    <div className="markdown-body chat-md">
                      <MarkdownRenderer content={turn.a} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="chat-row chat-row--ai">
                  <div className="chat-avatar chat-avatar--ai">AI</div>
                  <div className="chat-bubble chat-bubble--ai typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>

      {suggestions && suggestions.length > 0 && !hasThread && (
        <div className="chat-suggestions">
          <span className="chat-suggestions-label">Try asking</span>
          <div className="chat-suggestion-chips">
            {suggestions.map((s, i) => (
              <button
                key={i}
                className="chat-chip"
                onClick={() => askSuggestion && askSuggestion(s)}
                disabled={chatLoading}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {hasThread && !chatLoading && (
        <div className="chat-actions">
          {onSaveChat && (
            <button
              className="btn-ghost btn-sm"
              onClick={onSaveChat}
              disabled={chatSaved}
            >
              {chatSaved ? "Chat saved ✓" : "Save chat"}
            </button>
          )}
        </div>
      )}

      <div className="chat-input-bar">
        <input
          className="ask-input"
          placeholder="Ask a question about this content…"
          value={chatQuestion}
          onChange={(e) => setChatQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAsk()}
          disabled={chatLoading}
        />
        <button
          className="btn-primary"
          onClick={onAsk}
          disabled={chatLoading || !chatQuestion.trim()}
        >
          {chatLoading ? "Thinking…" : "Ask"}
        </button>
      </div>
    </div>
  );
}

function MarkdownRenderer({ content }) {
  return <ReactMarkdown>{content}</ReactMarkdown>;
}
