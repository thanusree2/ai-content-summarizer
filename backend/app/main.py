import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import engine, Base
from app.routers import auth, summaries, user, chat

logging.basicConfig(level=logging.INFO)

settings = get_settings()

# Import all models so they are registered with Base
from app.models import user as _user_model
from app.models import summary as _summary_model
from app.models import chat as _chat_model

Base.metadata.create_all(bind=engine)

# Add 'mode' column if missing (for existing SQLite DBs)
if settings.DATABASE_URL.startswith("sqlite"):
    with engine.connect() as conn:
        cols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(summaries)").fetchall()]
        if "mode" not in cols:
            conn.exec_driver_sql("ALTER TABLE summaries ADD COLUMN mode TEXT")
            conn.commit()

app = FastAPI(title=settings.APP_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(summaries.router)
app.include_router(user.router)
app.include_router(chat.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
