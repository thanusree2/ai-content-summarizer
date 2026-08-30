from typing import Annotated
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.summary import Summary
from app.schemas.summary import SummaryCreate, SummaryUpdate, SummaryResponse
from app.utils.auth import get_current_user
from app.services.ai_service import (
    generate_summary,
    fetch_url_content,
    extract_file_content,
    ask_content,
    suggest_questions,
    detect_content_type,
)

router = APIRouter(prefix="/api/summaries", tags=["summaries"])


@router.post("/", response_model=SummaryResponse, status_code=status.HTTP_201_CREATED)
def create_summary(
    payload: SummaryCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
    preview: bool = False,
):
    content = payload.source_text or ""

    if payload.source_url and not content:
        content = fetch_url_content(payload.source_url)

    if not content.strip():
        raise HTTPException(status_code=400, detail="Provide a URL or paste some content to summarize")

    if preview:
        # Generate for preview WITHOUT saving to the dashboard.
        result = generate_summary(content, payload.user_instruction, payload.mode)
        title = payload.title or (
            payload.source_url[:80] if payload.source_url else content[:80].replace("\n", " ") + "..."
        )
        return SummaryResponse(
            id=0,
            title=title,
            source_url=payload.source_url,
            source_text=content[:5000],
            user_instruction=payload.user_instruction,
            result=result,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

    # Normal save: reuse the generated result if provided (from a preview),
    # otherwise generate it now.
    result = payload.result or generate_summary(content, payload.user_instruction, payload.mode)

    title = payload.title
    if not title:
        title = payload.source_url[:80] if payload.source_url else content[:80].replace("\n", " ") + "..."

    summary = Summary(
        user_id=current_user.id,
        title=title,
        source_url=payload.source_url,
        source_text=content[:5000],
        user_instruction=payload.user_instruction,
        result=result,
        mode=payload.mode,
    )
    db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary


@router.post("/{summary_id}/ask", response_model=dict)
def ask_about_summary(
    summary_id: int,
    payload: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    summary = db.query(Summary).filter(Summary.id == summary_id, Summary.user_id == current_user.id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    question = (payload.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Ask a question about your content")

    history = payload.get("history")
    mode = payload.get("mode")

    try:
        answer = ask_content(summary.source_text or "", question, history, mode)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    if not answer:
        raise HTTPException(status_code=503, detail="AI assistant is currently unavailable")
    return {"answer": answer}


@router.get("/{summary_id}/suggestions", response_model=dict)
def summary_suggestions(
    summary_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    summary = db.query(Summary).filter(Summary.id == summary_id, Summary.user_id == current_user.id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    questions = suggest_questions(summary.source_text or "", summary.title, count=4)
    return {"questions": questions}


@router.post("/upload", response_model=SummaryResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    user_instruction: str | None = Form(None),
    title: str | None = Form(None),
    mode: str | None = Form(None),
    result: str | None = Form(None),
    preview: bool = Form(False),
):
    allowed = (".pdf", ".docx", ".txt")
    if not any(file.filename.lower().endswith(ext) for ext in allowed):
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(allowed)}")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10 MB.")

    try:
        content = extract_file_content(file.filename, file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not content.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the file")

    final_title = title or file.filename

    if preview:
        # Generate for preview WITHOUT saving to the dashboard.
        result_text = generate_summary(content, user_instruction, mode)
        return SummaryResponse(
            id=0,
            title=final_title,
            source_url=None,
            source_text=content[:5000],
            user_instruction=user_instruction,
            result=result_text,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

    # Save: reuse a previously generated result if provided, otherwise generate.
    result_text = result or generate_summary(content, user_instruction, mode)

    summary = Summary(
        user_id=current_user.id,
        title=final_title,
        source_url=None,
        source_text=content[:5000],
        user_instruction=user_instruction,
        result=result_text,
        mode=mode,
    )
    db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary


@router.post("/{summary_id}/modify", response_model=SummaryResponse)
def modify_summary(
    summary_id: int,
    payload: SummaryUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    summary = db.query(Summary).filter(Summary.id == summary_id, Summary.user_id == current_user.id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    summary.result = payload.result
    if payload.title:
        summary.title = payload.title
    db.commit()
    db.refresh(summary)
    return summary


@router.get("/", response_model=list[SummaryResponse])
def list_summaries(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    return db.query(Summary).filter(Summary.user_id == current_user.id).order_by(Summary.created_at.desc()).all()


@router.get("/{summary_id}", response_model=SummaryResponse)
def get_summary(
    summary_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    summary = db.query(Summary).filter(Summary.id == summary_id, Summary.user_id == current_user.id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    return summary


@router.delete("/{summary_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_summary(
    summary_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    summary = db.query(Summary).filter(Summary.id == summary_id, Summary.user_id == current_user.id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    db.delete(summary)
    db.commit()
    return None
