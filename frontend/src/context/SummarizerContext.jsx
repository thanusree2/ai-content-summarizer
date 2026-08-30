import { createContext, useContext, useState, useEffect, useRef } from "react";
import { summaries, chats } from "../api";
import { useAuth } from "./AuthContext";

const SummarizerContext = createContext(null);

export const PROGRESS_STEPS = [
  "Extracting content",
  "Identifying key concepts",
  "Generating summary",
];

export function SummarizerProvider({ children }) {
  const { token } = useAuth();
  const prevTokenRef = useRef(token);

  const [mode, setMode] = useState("url");
  const [summaryMode, setSummaryMode] = useState("study");
  const [form, setForm] = useState({
    source_url: "",
    source_text: "",
    user_instruction: "",
    title: "",
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [sourceLength, setSourceLength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editResult, setEditResult] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [chatQuestion, setChatQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSaved, setChatSaved] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [saveTitle, setSaveTitle] = useState("");

  // Reset everything when user logs out or a different user logs in
  useEffect(() => {
    if (prevTokenRef.current !== token) {
      prevTokenRef.current = token;
      setForm({ source_url: "", source_text: "", user_instruction: "", title: "" });
      setSelectedFile(null);
      setResult(null);
      setCurrentId(null);
      setEditing(false);
      setEditResult("");
      setShowSave(false);
      setSaved(false);
      setSaving(false);
      setChat([]);
      setSuggestions([]);
      setChatQuestion("");
      setChatSaved(false);
      setError("");
      setSourceLength(0);
      setSaveTitle("");
      setMode("url");
      setSummaryMode("study");
    }
  }, [token]);

  const loadSuggestions = async (id) => {
    if (!id) return;
    try {
      const { data } = await summaries.suggestions(id);
      setSuggestions(data.questions || []);
    } catch {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    if (!loading) return;
    setProgressStep(0);
    const timers = [];
    PROGRESS_STEPS.forEach((_, i) => {
      if (i === PROGRESS_STEPS.length - 1) return;
      timers.push(setTimeout(() => setProgressStep(i + 1), (i + 1) * 2600));
    });
    return () => timers.forEach(clearTimeout);
  }, [loading]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const allowed = [".pdf", ".docx", ".txt"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setError("Unsupported file type. Allowed: PDF, DOCX, TXT");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Max 10 MB.");
      return;
    }
    setSelectedFile(file);
    setError("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (mode === "url" && !form.source_url.trim()) {
      setError("Enter a URL to summarize");
      return;
    }
    if (mode === "text" && !form.source_text.trim()) {
      setError("Paste some content to summarize");
      return;
    }
    if (mode === "upload" && !selectedFile) {
      setError("Select a file to upload");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setEditing(false);
    setSaved(false);
    setCurrentId(null);
    setChat([]);
    setSuggestions([]);

    try {
      // Generate a PREVIEW only — nothing is saved to the dashboard yet.
      let data;
      if (mode === "upload") {
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (form.user_instruction) formData.append("user_instruction", form.user_instruction);
        if (form.title) formData.append("title", form.title);
        if (summaryMode) formData.append("mode", summaryMode);
        ({ data } = await summaries.upload(formData, true));
      } else {
        const payload = {
          user_instruction: form.user_instruction || null,
          title: form.title || null,
          mode: summaryMode,
        };
        if (mode === "url") {
          payload.source_url = form.source_url;
        } else {
          payload.source_text = form.source_text;
        }
        ({ data } = await summaries.create(payload, true));
      }
      setResult(data.result);
      setShowSave(true);
      if (mode === "text") {
        setSourceLength(form.source_text.trim().length);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  };

  const saveSummary = async () => {
    if (!result) {
      setError("Nothing to save. Generate a summary first.");
      return null;
    }
    setSaving(true);
    setError("");
    try {
      let data;
      const titleToSave = saveTitle.trim() || form.title || null;
      if (mode === "upload") {
        const formData = new FormData();
        if (selectedFile) formData.append("file", selectedFile);
        if (form.user_instruction) formData.append("user_instruction", form.user_instruction);
        if (titleToSave) formData.append("title", titleToSave);
        if (summaryMode) formData.append("mode", summaryMode);
        formData.append("result", result);
        ({ data } = await summaries.upload(formData));
      } else {
        const payload = {
          user_instruction: form.user_instruction || null,
          title: titleToSave,
          mode: summaryMode,
          result,
        };
        if (mode === "url") {
          payload.source_url = form.source_url;
        } else {
          payload.source_text = form.source_text;
        }
        ({ data } = await summaries.create(payload));
      }
      setCurrentId(data.id);
      setSaved(true);
      setSaveTitle(data.title || "");
      loadSuggestions(data.id);
      return data;
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to save summary";
      setError(msg);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateSummary = async () => {
    if (!currentId) return;
    setSaving(true);
    setError("");
    try {
      const titleToSave = saveTitle.trim() || form.title || null;
      await summaries.modify(currentId, { result, title: titleToSave });
      setSaved(true);
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to update summary";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAsk = async () => {
    if (!chatQuestion.trim()) return;
    const q = chatQuestion.trim();
    setChatQuestion("");
    setChat((prev) => [...prev, { q, a: "" }]);
    setChatLoading(true);
    setError("");
    try {
      const id = currentId;
      if (!id) {
        setChat((prev) => prev.slice(0, -1));
        setChatQuestion(q);
        setError("Save the summary to dashboard first, then ask questions.");
        return;
      }
      const history = chat.map((t) => ({ q: t.q, a: t.a }));
      const { data } = await summaries.ask(id, q, history, summaryMode);
      setChat((prev) => {
        const next = [...prev];
        next[next.length - 1].a = data.answer;
        return next;
      });
      // Refresh suggestions after each answer
      if (currentId) {
        loadSuggestions(currentId);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to get an answer");
      setChat((prev) => prev.slice(0, -1));
      setChatQuestion(q);
    } finally {
      setChatLoading(false);
    }
  };

  const saveChat = async () => {
    const id = currentId;
    if (!id || chat.length === 0) return;
    try {
      await chats.save(id, chat);
      setChatSaved(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save chat");
    }
  };

  const handleModify = async () => {
    if (!currentId || !editResult.trim()) return;
    try {
      const { data } = await summaries.modify(currentId, { result: editResult });
      setResult(data.result);
      setEditing(false);
    } catch {
      setError("Failed to update summary");
    }
  };

  const startEditing = () => {
    setEditResult(result);
    setEditing(true);
  };

  const resetForm = () => {
    setForm({ source_url: "", source_text: "", user_instruction: "", title: "" });
    setSelectedFile(null);
    setResult(null);
    setCurrentId(null);
    setEditing(false);
    setShowSave(false);
    setSaved(false);
    setSaving(false);
    setChat([]);
    setSuggestions([]);
    setChatQuestion("");
    setChatSaved(false);
    setError("");
    setSourceLength(0);
    setSaveTitle("");
  };

  const askSuggestion = (s) => {
    setChatQuestion(s);
  };

  const value = {
    mode,
    setMode,
    summaryMode,
    setSummaryMode,
    form,
    setForm,
    selectedFile,
    dragOver,
    result,
    currentId,
    sourceLength,
    loading,
    progressStep,
    error,
    editing,
    setEditing,
    editResult,
    setEditResult,
    showSave,
    saved,
    saving,
    chatQuestion,
    setChatQuestion,
    chat,
    suggestions,
    chatLoading,
    chatSaved,
    askSuggestion,
    saveTitle,
    setSaveTitle,
    handleChange,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleSubmit,
    saveSummary,
    updateSummary,
    saveChat,
    handleAsk,
    handleModify,
    startEditing,
    resetForm,
  };

  return (
    <SummarizerContext.Provider value={value}>{children}</SummarizerContext.Provider>
  );
}

export const useSummarizer = () => useContext(SummarizerContext);
