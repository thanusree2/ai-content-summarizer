import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import engine, Base
from app.routers import auth, summaries, user, chat

logging.basicConfig(level=logging.INFO)

settings = get_settings()
Base.metadata.create_all(bind=engine)

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
