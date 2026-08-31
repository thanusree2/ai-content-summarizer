import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("tincture_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("tincture_token");
      localStorage.removeItem("tincture_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const auth = {
  signup: (data) => api.post("/auth/signup", data),
  login: (data) => api.post("/auth/login", data),
};

export const summaries = {
  create: (data, preview = false) => {
    const params = preview ? { preview: 1 } : {};
    return api.post("/summaries/", data, { params });
  },
  upload: (formData, preview = false) =>
    api.post("/summaries/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      params: preview ? { preview: 1 } : {},
    }),
  list: () => api.get("/summaries/"),
  get: (id) => api.get(`/summaries/${id}`),
  modify: (id, data) => api.post(`/summaries/${id}/modify`, data),
  delete: (id) => api.delete(`/summaries/${id}`),
  ask: (id, question, history, mode) => api.post(`/summaries/${id}/ask`, { question, history, mode }),
  suggestions: (id) => api.get(`/summaries/${id}/suggestions`),
};

export const chats = {
  save: (summaryId, messages) => api.post(`/chats/${summaryId}`, { messages }),
  load: (summaryId) => api.get(`/chats/${summaryId}`),
};

export const user = {
  me: () => api.get("/user/me"),
};

export default api;
