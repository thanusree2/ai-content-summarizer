import { useNavigate } from "react-router-dom";

export default function BackButton({ to, label = "Back" }) {
  const navigate = useNavigate();
  const handleClick = () => {
    if (to) {
      navigate(to);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/summarize");
    }
  };

  return (
    <button className="btn-ghost btn-sm back-button" onClick={handleClick}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"/>
        <polyline points="12 19 5 12 12 5"/>
      </svg>
      {label}
    </button>
  );
}
