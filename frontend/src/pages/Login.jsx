import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth } from "../api";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
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
    if (!form.email || !form.password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      const { data } = await auth.login(form);
      login(data.user, data.access_token);
      navigate("/summarize");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="brand-mark brand-mark-lg">AI</span>
          <h1>Welcome back</h1>
          <p className="auth-sub">Sign in to access your summaries.</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert-error">{error}</div>}
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
              placeholder="Your password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="auth-footer">
          Don't have an account? <Link to="/signup">Create one</Link>
        </p>
      </div>
    </div>
  );
}
