import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SummarizerProvider } from "./context/SummarizerContext";
import Navbar from "./components/Navbar";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Summarizer from "./pages/Summarizer";
import Summaries from "./pages/Summaries";
import SummaryDetail from "./pages/SummaryDetail";
import Profile from "./pages/Profile";
import "./App.css";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/summarize" replace /> : children;
}

export default function App() {
  return (
    <ThemeProvider>
      <SummarizerProvider>
        <div className="app">
          <Navbar />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<Navigate to="/summarize" replace />} />
              <Route
                path="/signup"
                element={
                  <GuestRoute>
                    <Signup />
                  </GuestRoute>
                }
              />
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <Login />
                  </GuestRoute>
                }
              />
              <Route
                path="/summarize"
                element={
                  <ProtectedRoute>
                    <Summarizer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/summaries"
                element={
                  <ProtectedRoute>
                    <Summaries />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/summaries/:id"
                element={
                  <ProtectedRoute>
                    <SummaryDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
        </div>
      </SummarizerProvider>
    </ThemeProvider>
  );
}
