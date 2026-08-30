import { useNavigate } from "react-router-dom";
import { useSummarizer } from "../context/SummarizerContext";

export default function ResumeBanner() {
  const navigate = useNavigate();
  const s = useSummarizer();

  const hasActiveWork =
    (s.loading && (s.result === null)) ||
    (!s.loading && s.result !== null);

  if (!hasActiveWork) return null;

  return (
    <button className="resume-banner" onClick={() => navigate("/summarize")}>
      <span className="resume-banner-indicator">
        {s.loading ? (
          <span className="resume-banner-spinner" />
        ) : (
          "✅"
        )}
      </span>
      <span className="resume-banner-text">
        {s.loading
          ? "Summary is still generating… click to return"
          : "You have a summary in progress — click to return"}
      </span>
      <span className="resume-banner-arrow">→</span>
    </button>
  );
}
