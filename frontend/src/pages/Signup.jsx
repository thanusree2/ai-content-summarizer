import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth } from "../api";

export default function Signup() {
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.password) {
      setError("All fields are required");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const { data } = await auth.signup(form);
      login(data.user, data.access_token);
      navigate("/summarize");
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="brand-mark brand-mark-lg">AI</span>
          <h1>Create your account</h1>
          <p className="auth-sub">Start learning smarter.</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              placeholder="Ada Lovelace"
              value={form.full_name}
              onChange={handleChange}
              autoComplete="name"
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="ada@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
