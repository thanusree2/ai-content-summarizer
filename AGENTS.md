# AGENTS.md

## Layout

- `backend/` — FastAPI + SQLAlchemy + SQLite app ("Tincture"). Python 3.12, deps pinned in `requirements.txt`, no venv checked in.
- `frontend/` — React 19 + Vite (plain JS/JSX), linted with oxlint.
- No root manifest, tests, formatter/typecheck config, or CI anywhere. Verify changes by running both servers and hitting endpoints (`GET /api/health`).

## Commands

```powershell
# backend — must run from backend/
pip install -r requirements.txt
Copy-Item .env.example .env   # then set GROQ_API_KEY
uvicorn app.main:app --reload

# frontend — from frontend/
npm install
npm run dev    # proxies /api -> http://localhost:8000
npm run lint   # oxlint
```

## Gotchas

- **Run uvicorn from `backend/`.** `.env` discovery and the SQLite path `sqlite:///./tincture.db` both resolve against the CWD (`app/config.py`); launching elsewhere silently creates a second empty DB with default settings.
- **No migrations.** Tables come from `Base.metadata.create_all()` at startup (`app/main.py`) — it never alters existing tables. After changing a model, delete `backend/tincture.db` and restart (loses local data).
- **Missing `GROQ_API_KEY` fails silently.** `generate_summary` falls back to `_mock_summary` and the endpoint still returns 201. Generic/boilerplate output usually means the key isn't loaded, not broken code.
- **LLM access** is Groq via the OpenAI SDK (`base_url="https://api.groq.com/openai/v1"`, model from `GROQ_MODEL`, default `openai/gpt-oss-120b`). Inputs over ~4000 chars are split into sequential per-chunk calls (2s delay); rate-limited chunks get an inline `[Chunk N skipped]` marker instead of failing the request.
- **URL extraction** lives in `app/services/ai_service.py`: YouTube (oEmbed + `youtube-transcript-api`), image URLs (detected but unsupported — no vision model), HTML articles (stdlib `HTMLParser`). Stored `source_text` truncates at 5000 chars.
- **All routes are prefixed `/api/`** to match the Vite proxy. New routers must be registered in `app/main.py`; CORS origins come from settings (localhost:5173 and :3000 by default).
- **Auth:** JWT bearer tokens (python-jose) + bcrypt. Frontend stores the token in localStorage key `tincture_token`; its axios interceptor redirects to `/login` on any 401 (`frontend/src/api.js`).
- Endpoints intentionally use sync `def` with sync SQLAlchemy sessions — keep new endpoints sync unless the data layer moves to async first.
