import logging
import re
import time
from urllib.parse import urlparse

import httpx
from openai import OpenAI
from app.config import get_settings

try:
    import google.generativeai as genai
except Exception:
    genai = None

logger = logging.getLogger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# Gemini client
# ---------------------------------------------------------------------------
_gemini_configured = False


def _get_gemini_model():
    global _gemini_configured
    if genai is None or not settings.GEMINI_API_KEY:
        return None
    if not _gemini_configured:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _gemini_configured = True
    model_name = settings.GEMINI_MODEL or "gemini-2.0-flash"
    return genai.GenerativeModel(model_name)


# ---------------------------------------------------------------------------
# Groq client (fallback)
# ---------------------------------------------------------------------------
def get_groq_client() -> OpenAI | None:
    if not settings.GROQ_API_KEY:
        return None
    return OpenAI(
        api_key=settings.GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )


# ---------------------------------------------------------------------------
# Unified AI call — Gemini first, Groq fallback
# ---------------------------------------------------------------------------
def _call_gemini(system_prompt: str, user_prompt: str) -> str:
    model = _get_gemini_model()
    if model is None:
        raise RuntimeError("No Gemini API key configured")
    last_err = None
    for attempt in range(RATE_LIMIT_RETRIES):
        try:
            response = model.generate_content(
                f"{system_prompt}\n\n---\n\n{user_prompt}",
                generation_config=genai.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=4096,
                ),
            )
            return response.text or ""
        except Exception as e:
            last_err = e
            if _is_rate_limit(e):
                wait = 7 * (attempt + 1)
                logger.warning(
                    "Gemini rate limit hit (attempt %d/%d). Waiting %ds before retrying.",
                    attempt + 1, RATE_LIMIT_RETRIES, wait,
                )
                time.sleep(wait)
                continue
            raise
    raise last_err


RATE_LIMIT_RETRIES = 5
CHUNK_DELAY_SECONDS = 6
DAILY_TOKEN_WAIT_SECONDS = 120  # waited before retrying once after a daily-token limit


class GroqCallError(Exception):
    """Raised when a Groq call ultimately fails after retries."""

    def __init__(self, message: str, daily_token: bool = False):
        super().__init__(message)
        self.daily_token = daily_token


def _is_rate_limit(e: Exception) -> bool:
    error_str = str(e).lower()
    return "rate" in error_str or "limit" in error_str or "429" in error_str


def _is_daily_token_limit(e: Exception) -> bool:
    error_str = str(e).lower()
    return ("token" in error_str and ("per day" in error_str or "tpd" in error_str or "daily" in error_str))


def _call_groq(client: OpenAI, system_prompt: str, user_prompt: str) -> str:
    """Single Groq API call with retry/backoff on rate limits.

    Raises GroqCallError if the call ultimately fails (after retries).
    """
    last_err: Exception | None = None
    for attempt in range(RATE_LIMIT_RETRIES):
        try:
            response = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=4096,
            )
            result = response.choices[0].message.content or ""
            # Strip any  thinking tags if present
            result = re.sub(r" thinking.*? response", "", result, flags=re.DOTALL).strip()
            return result
        except Exception as e:
            last_err = e
            if _is_rate_limit(e):
                if _is_daily_token_limit(e):
                    # Daily token budget exhausted. A short retry won't help because
                    # every retry also consumes tokens toward the already-spent cap,
                    # so only wait/retry once, then give up with a clear message.
                    if attempt == 0:
                        logger.warning(
                            "Groq daily token limit hit. Waiting %ds then trying once more.",
                            DAILY_TOKEN_WAIT_SECONDS,
                        )
                        time.sleep(DAILY_TOKEN_WAIT_SECONDS)
                        continue
                    raise GroqCallError(
                        "The AI provider's daily token budget for this account is exhausted. "
                        "It will reset later today — please try again then.",
                        daily_token=True,
                    )
                # Per-minute request rate limit: wait, then retry with backoff.
                wait = 7 * (attempt + 1)  # 7s, 14s, 21s, 28s, 35s
                logger.warning(
                    "Groq rate limit hit (attempt %d/%d). Waiting %ds before retrying.",
                    attempt + 1, RATE_LIMIT_RETRIES, wait,
                )
                time.sleep(wait)
                continue
            raise GroqCallError(f"Groq API error: {e}")
    raise GroqCallError(f"Groq rate limit retries exhausted: {last_err}")


def _call_ai(system_prompt: str, user_prompt: str) -> str:
    """Try Gemini first, fall back to Groq on failure."""
    # --- Gemini ---
    try:
        return _call_gemini(system_prompt, user_prompt)
    except Exception as e:
        logger.warning("Gemini failed (%s: %s), falling back to Groq", type(e).__name__, e)

    # --- Groq fallback ---
    client = get_groq_client()
    if client is None:
        raise RuntimeError("Both Gemini and Groq are unavailable")
    return _call_groq(client, system_prompt, user_prompt)


def _split_content(content: str, max_chars: int = 4000) -> list[str]:
    """Split content into chunks on sentence boundaries. Prepends title to each chunk."""
    if len(content) <= max_chars:
        return [content]

    # Extract title/header lines (everything before the actual transcript)
    header_lines = []
    body = content
    for line in content.split("\n"):
        if line.lower().startswith("transcript:"):
            header_lines.append(line)
            body = content[content.index(line) + len(line):].strip()
            break
        elif line.lower().startswith("title:") or line.lower().startswith("channel:"):
            header_lines.append(line)
        else:
            break

    # If no header found, try to grab first line as title
    if not header_lines:
        first_line = content.split("\n", 1)[0]
        header_lines.append(first_line)
        body = content[len(first_line):].strip()

    header = "\n".join(header_lines)
    header_with_label = header + "\n\nContinued:\n"

    # Split body into sentences
    sentences = re.split(r'(?<=[.!?])\s+', body)

    chunks = []
    current = ""

    for sentence in sentences:
        # Each chunk gets: header + accumulated sentences
        candidate = current + " " + sentence if current else sentence
        # Account for the header overhead in the chunk
        full_chunk = header_with_label + candidate
        if len(full_chunk) > max_chars and current:
            chunks.append(header_with_label + current)
            current = sentence
        else:
            current = candidate

    if current:
        chunks.append(header_with_label + current)

    return chunks


BASE_RULES = (
    "RULES:\n"
    "- ONLY explain the actual topics and concepts taught in the source. Do NOT add info about instructors, channels, their history, or biographies.\n"
    "- Use the EXACT examples and explanations from the source material.\n"
    "- After each concept, add your own extra knowledge to make it clearer.\n"
    "- The goal is: after reading this, the user fully understands the subject matter."
)

# Each mode has its OWN complete system prompt so the output is genuinely distinct
# (different length, format, tone, and structure) instead of a shared template.
SUMMARY_MODES = {
    "quick": {
        "label": "Quick Summary",
        "system_prompt": (
            "You are a fast summarizer. Produce a QUICK, benefit-focused summary only.\n\n"
            "OUTPUT FORMAT EXACTLY (nothing else):\n"
            "## Key Takeaways\n"
            "- 3 to 5 short bullet points. Each bullet is ONE sentence.\n"
            "- Cover only the single most important ideas. No sub-sections, no extra headings, no long explanation.\n\n"
            f"{BASE_RULES}\n"
            "Keep the entire output under 120 words."
        ),
        "post_instruction": (
            "Important: this is a QUICK summary. Ignore any instruction above that asks you to be "
            "exhaustive or to use many headings. Output ONLY a short '## Key Takeaways' bullet list, "
            "under 120 words."
        ),
    },
    "bullets": {
        "label": "Bullet Points",
        "system_prompt": (
            "You are a concise summarizer. Summarize the source as CLEAN BULLET POINTS grouped by topic.\n\n"
            "OUTPUT FORMAT:\n"
            "- Use H3 headings only for topic groups (### Topic name), each followed by a short bullet list.\n"
            "- No long paragraphs anywhere. Every point is a single-line bullet.\n"
            "- Do not add filler or repetition.\n\n"
            f"{BASE_RULES}"
        ),
        "post_instruction": (
            "Reminder: output as bullet points grouped under short H3 topic headings. Use NO long paragraphs."
        ),
    },
    "explain": {
        "label": "Explain Simply",
        "system_prompt": (
            "You are an expert teacher for absolute beginners (a 10-year-old).\n\n"
            "RULES (these override everything else):\n"
            "- Use ONLY simple everyday words. Replace every technical term with plain language.\n"
            "- Use an analogy or real-world example for each concept.\n"
            "- Short sentences. Friendly, warm tone. Avoid all jargon, formula names, and dense detail.\n"
            f"{BASE_RULES}\n"
            "- Keep explanations brief and intuitive."
        ),
        "post_instruction": (
            "Write as if explaining to a 10-year-old: simple words, analogies, no jargon, short friendly sentences."
        ),
    },
    "notes": {
        "label": "Notes Mode",
        "system_prompt": (
            "You are a study-notes writer. Produce CLEAN, SCANNABLE study notes.\n\n"
            "OUTPUT STRUCTURE:\n"
            "## Overview (2-3 sentences)\n"
            "## Key Points (organized bullet list with bolded terms)\n"
            "## Example(s) (real example from the source)\n"
            "## Practice / Remember (3 most important things)\n"
            "Use H2/H3 headings and bold key terms. Concise, no fluff.\n\n"
            f"{BASE_RULES}"
        ),
        "post_instruction": (
            "Output structured study notes following: Overview, Key Points, Examples, and Remember sections. Be concise and scannable."
        ),
    },
    "study": {
        "label": "Study Mode",
        "system_prompt": (
            "You are a thorough study guide writer.\n\n"
            "OUTPUT STRUCTURE:\n"
            "## Key Takeaways (3-5 bullet points)\n"
            "## Detailed Explanation (cover EVERY concept: what it is, how it works, why it matters, example)\n"
            "## Important Concepts (a short list of key terms/themes)\n"
            "## Important Facts (facts not to miss)\n"
            "## Remember This (the 3 most important things)\n"
            "Use markdown headings, bold key terms, and code blocks where useful.\n\n"
            f"{BASE_RULES}\n"
            "Be thorough and beginner-friendly."
        ),
        "post_instruction": "",
    },
    "deep": {
        "label": "Deep Dive",
        "system_prompt": (
            "You are an analytical deep-dive author.\n\n"
            "OUTPUT STRUCTURE:\n"
            "## Context & Background (why this topic matters, where it fits)\n"
            "## Core Concepts (deep explanation of each, with underlying principles)\n"
            "## Nuances & Trade-offs (edge cases, limitations, advanced implications)\n"
            "## Connections (how concepts relate to each other and to the bigger picture)\n"
            "## Summary\n"
            "Use markdown headings and code blocks. Assume a motivated reader who wants depth, not shortcuts.\n\n"
            f"{BASE_RULES}"
        ),
        "post_instruction": (
            "Provide a deep, analytical treatment: context, underlying principles, nuances, trade-offs, and connections — not a shallow bullet recap."
        ),
    },
}


def _mode_system_prompt(mode: str | None) -> str:
    """Return a fully self-contained system prompt for the mode (or a sensible default)."""
    for key in (mode, "study"):
        if key and key in SUMMARY_MODES:
            return SUMMARY_MODES[key]["system_prompt"]
    return SUMMARY_MODES["study"]["system_prompt"]


def _mode_post_instruction(mode: str | None) -> str:
    if mode and mode in SUMMARY_MODES:
        return SUMMARY_MODES[mode]["post_instruction"]
    return ""


def _rate_limit_message(e: GroqCallError) -> str:
    """Return a friendly markdown message explaining why generation stopped."""
    if e.daily_token:
        return (
            "# ⚠️ Daily AI budget reached\n\n"
            "The AI provider's **daily token limit** for this account is currently exhausted, "
            "so this summary could not be generated.\n\n"
            "- It resets automatically later today.\n"
            "- Try again in a few hours, or use a smaller amount of content.\n"
            "- Alternatively, upgrade the API key's plan at console.groq.com for more capacity.\n"
        )
    return (
        "# ⚠️ AI temporarily unavailable\n\n"
        "The AI service is currently rate-limited or busy and could not finish this request.\n\n"
        "- Please wait a little and try again.\n"
    )


# ---------------------------------------------------------------------------
# Content-type detection: adapt the output to whatever we are summarizing
# ---------------------------------------------------------------------------
RESUME_STRONG_HINTS = (
    "cgpa", "work experience", "professional experience", "career objective",
    "summary of qualifications", "resume summary", "this is my resume",
    "curriculum vitae", "objective:", "certifications:", "education:",
)

# Words that alone signal a resume (matched on word boundaries, ignoring emoji/punctuation)
RESUME_SECTION_HINTS = (
    "skills", "education", "projects", "internship", "experience", "objective",
    "certifications", "achievements", "languages", "summary",
)

ABSTRACT_TERMS = (
    "phenomenolog", "ontolog", "epistemolog", "hermeneutic", "noetic", "protentional",
    "teleological", "metaphysic", "deconstruction", "semiotic", "existential", "a priori",
    "hegel", "kant", "heidegger", "foucault", "discourse", "subjectiv",
)


def detect_content_type(content: str) -> str:
    """Return 'resume', 'text' (complex/abstract writing), or 'document'."""
    text = content.lower()
    # Normalize: strip emoji and compress whitespace so headings like
    # "💼 Work Experience" or "🛠️ Skills" are still found.
    folded = " ".join(text.split())

    # 1) Resume: strong, specific cues
    if any(h in text for h in RESUME_STRONG_HINTS):
        return "resume"
    if folded.startswith("resume") or "my resume" in text or folded.startswith("curriculum vitae"):
        return "resume"

    # 2) Resume: multiple section headings (each on its own line) without needing colons
    headings_found = sum(1 for h in RESUME_SECTION_HINTS if re.search(rf"(^|[\s\U0001F000-\U0001FAFF])\s*{re.escape(h)}\s*(:|$)", text))
    if headings_found >= 2:
        return "resume"

    # 3) Complex / abstract text: long dense sentences, little structure, abstract words
    sentences = [s for s in text.replace("\n", " ").split(".") if s.strip()]
    if sentences:
        avg_words = sum(len(s.split()) for s in sentences) / len(sentences)
        structure_markers = sum(text.count(m) for m in ("\n", "- ", "* ", "##", "# "))
        has_abstract = any(t in text for t in ABSTRACT_TERMS)
        if avg_words > 24 and structure_markers < 15 and has_abstract:
            return "text"

    # 4) Everything else
    return "document"


def _content_type_system_prompt(content_type: str, mode: str | None) -> str | None:
    """Return a dedicated system prompt for a content type, or None to fall back to the mode prompt."""
    if content_type == "resume":
        return (
            "You are a professional resume reader. Summarize the resume in a clear, flowing "
            "explanatory paragraph style — NOT bullet lists.\n\n"
            "OUTPUT FORMAT (just one section):\n"
            "## Resume Summary\n"
            "Write 2-3 short paragraphs in plain English describing who the person is, their "
            "background, key skills, experience, education, projects, and achievements. "
            "Write it as a natural explanatory description, not bullet points.\n\n"
            "At the very end, add a short '## Quick Overview' bullet list only if it adds value:\n"
            "- Name\n- Key focus area\n- Top skill\n- Standout achievement\n\n"
            "Keep it factual and based only on what is in the resume."
        )
    if content_type == "text":
        return (
            "You are a brilliant teacher who explains hard, dense writing in very simple language.\n\n"
            "OUTPUT FORMAT EXACTLY:\n"
            "## Simple summary\n"
            "Explain the core meaning in a few clear, plain-English paragraphs. No jargon.\n\n"
            "## In very simple words\n"
            "One short paragraph (2-4 sentences) restating the main idea in the simplest possible way.\n\n"
            "## Example\n"
            "Give a concrete everyday analogy or example that makes the idea intuitive.\n\n"
            "## Key terms\n"
            "A table with columns | Difficult term | Simple meaning | covering the important terms.\n\n"
            "## One-line meaning\n"
            "A single sentence capturing the entire message.\n\n"
            "    Make every part very understandable, as if explaining to a beginner."
        )
    return None


def generate_summary(
    content: str,
    instruction: str | None = None,
    mode: str | None = None,
    content_type: str | None = None,
) -> str:
    # Detect the kind of content (resume / complex text / general document)
    if not content_type:
        content_type = detect_content_type(content)

    # Content-type prompt wins over the summary-mode prompt when both apply.
    type_prompt = _content_type_system_prompt(content_type, mode)
    if type_prompt:
        system_prompt = type_prompt
        post_instruction = ""
    else:
        system_prompt = _mode_system_prompt(mode)
        post_instruction = _mode_post_instruction(mode)

    # Detect source type
    source_label = "the following content"
    if "Transcript:" in content:
        source_label = "the following video transcript"
    elif "Image description:" in content:
        source_label = "the following image description"

    instruction_text = ""
    if post_instruction:
        instruction_text += f"\n\nSPECIAL INSTRUCTIONS:\n{post_instruction}"
    if instruction:
        instruction_text += f"\nADDITIONAL USER INSTRUCTIONS: {instruction}"

    # Split long content into chunks
    chunks = _split_content(content, max_chars=4000)

    if len(chunks) == 1:
        # Short content — single call
        user_prompt = (
            "Explain the concepts from this source. Only cover the subject matter taught — "
            "do NOT add info about the instructor, channel, or their history.\n\n"
            f"{chunks[0]}{instruction_text}"
        )
        try:
            result = _call_ai(system_prompt, user_prompt)
            if result:
                return result
            return _mock_summary(content, instruction, mode)
        except (GroqCallError, RuntimeError) as e:
            return _rate_limit_message(e) if isinstance(e, GroqCallError) else str(e)
    else:
        # Long content — process each chunk, then combine
        logger.info("Splitting content into %d chunks for processing", len(chunks))
        all_parts = []
        title_match = re.search(r"Title:\s*(.+)", content[:500])
        title = title_match.group(1).strip() if title_match else "Content"

        rate_limited = False
        for i, chunk in enumerate(chunks):
            chunk_num = i + 1
            total = len(chunks)
            if i > 0 and not rate_limited:
                time.sleep(CHUNK_DELAY_SECONDS)
            user_prompt = (
                f"This is part {chunk_num} of {total} from {source_label}.\n"
                f"Explain the concepts in this section. Only cover the subject matter — "
                f"do NOT add info about the instructor, channel, or their history.\n\n{chunk}"
                f"{instruction_text}"
            )
            try:
                part = _call_ai(system_prompt, user_prompt)
                if part:
                    all_parts.append(part)
                    logger.info("Processed chunk %d/%d (%d chars)", chunk_num, total, len(part))
            except (GroqCallError, RuntimeError) as e:
                # Stop generating further chunks once the provider is out of budget.
                rate_limited = True
                logger.warning("Chunk %d/%d failed: %s", chunk_num, total, e)
                all_parts.append(f"\n> **Note:** {e}\n")
                all_parts.append(f"> Remaining sections ({total - chunk_num} more) were not generated.")
                break

        if all_parts:
            combined = f"# {title}\n\n" + "\n\n---\n\n".join(all_parts)
            return combined

    return _mock_summary(content, instruction, mode)


def ask_content(content: str, question: str, history: list | None = None, mode: str | None = None) -> str:
    """Answer a user question about the given content, keeping conversation context.
    Returns None if unavailable."""
    has_ai = _get_gemini_model() is not None or get_groq_client() is not None
    if not has_ai:
        return None

    mode_styles = {
        "quick": (
            "Keep answers SHORT and punchy. Use bullet points. "
            "Under 80 words. Lead with the single most important point."
        ),
        "bullets": (
            "Answer ONLY in bullet points. No paragraphs. "
            "Group related points under short bold labels if needed."
        ),
        "explain": (
            "Use simple everyday words as if explaining to a beginner. "
            "Use analogies and real-world examples. Short sentences, friendly tone, no jargon."
        ),
        "notes": (
            "Structure your answer like clean study notes. "
            "Use bold key terms, short bullet lists, and markdown headings if the answer is long."
        ),
        "study": (
            "Give a thorough, detailed answer. Cover what it is, how it works, and why it matters. "
            "Use examples from the content. Bold key terms."
        ),
        "deep": (
            "Provide a deep analytical answer. Cover context, underlying principles, nuances, "
            "and connections to the bigger picture. Assume a motivated reader who wants depth."
        ),
    }

    style = mode_styles.get(mode, mode_styles["study"])

    system_prompt = (
        "You are an AI study assistant. Answer the user's question clearly and completely, "
        "based PRIMARILY on the provided content. When the content does not cover the answer, "
        "clearly say so first, then add your own knowledge to help.\n"
        "GROUNDING RULE: The answer must stay about the MAIN CONCEPTS of the content, not "
        "minor examples or tangents. Ground every claim in the content.\n"
        f"STYLE: {style}\n"
        "- Use markdown where helpful.\n"
        "- Keep it under ~180 words unless the question demands more."
    )

    truncated = content[:12000] if len(content) > 12000 else content

    history_text = ""
    if history:
        history_lines = []
        for turn in history:
            history_lines.append(f"Q: {turn.get('q', '')}")
            if turn.get("a"):
                history_lines.append(f"A: {turn['a']}")
        history_text = "\n\nPREVIOUS CONVERSATION:\n" + "\n".join(history_lines)

    user_prompt = (
        f"CONTENT:\n{truncated}\n\n"
        f"{history_text}\n\n"
        f"QUESTION: {question}\n\n"
        "Answer based mainly on the content, clearly and understandably."
    )

    try:
        return _call_ai(system_prompt, user_prompt)
    except Exception as e:
        logger.error("AI ask error: %s", e)
        raise


def suggest_questions(content: str, title: str = "", count: int = 4) -> list[str]:
    """Generate relevant follow-up questions based on the main topics of the content."""
    has_ai = _get_gemini_model() is not None or get_groq_client() is not None
    if not has_ai:
        return []

    system_prompt = (
        "You are a study coach. Given a piece of content, generate questions a learner "
        "would naturally ask to understand its MAIN concepts.\n"
        "RULES:\n"
        "- Base questions on the central topics and key ideas of the content, NOT on minor examples.\n"
        "- Make questions specific and answerable from the content.\n"
        "- Vary question types (what, how, why, compare, example, apply).\n"
        "- Return EXACTLY the questions, one per line, no numbering, no extra text."
    )

    truncated = content[:8000] if len(content) > 8000 else content
    title_text = f"TITLE: {title}\n" if title else ""

    user_prompt = (
        f"{title_text}CONTENT:\n{truncated}\n\n"
        f"Generate {count} questions about the main concept(s) of this content.\n"
        "Output each question on its own line."
    )

    try:
        result = _call_ai(system_prompt, user_prompt)
        if not result:
            return []
        questions = [
            line.strip().lstrip("0123456789. ") for line in result.splitlines() if line.strip()
        ]
        return questions[:count]
    except Exception as e:
        logger.error("Groq suggestions error: %s", e)
        return []


# ---------------------------------------------------------------------------
# File extraction helpers
# ---------------------------------------------------------------------------

def extract_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF using PyMuPDF."""
    import fitz  # pymupdf

    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return "\n\n".join(pages).strip()


def extract_docx(file_bytes: bytes) -> str:
    """Extract text from a DOCX using python-docx."""
    import io
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs).strip()


def extract_file_content(filename: str, file_bytes: bytes) -> str:
    """Route to the right extractor based on file extension."""
    lower = filename.lower()

    if lower.endswith(".pdf"):
        return extract_pdf(file_bytes)
    elif lower.endswith(".docx"):
        return extract_docx(file_bytes)
    elif lower.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="replace").strip()
    else:
        raise ValueError(f"Unsupported file type: {filename}")


# ---------------------------------------------------------------------------
# URL content extraction — detects source type and extracts accordingly
# ---------------------------------------------------------------------------

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"}


def _extract_youtube_id(url: str) -> str | None:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r"(?:youtube\.com/watch\?.*?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def _fetch_youtube_content(url: str, video_id: str) -> str:
    """Fetch YouTube video title, description, and transcript."""
    parts = []

    # 1. Get video metadata via oEmbed
    try:
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        resp = httpx.get(oembed_url, timeout=10.0)
        if resp.status_code == 200:
            meta = resp.json()
            parts.append(f"Title: {meta.get('title', 'Unknown')}")
            parts.append(f"Channel: {meta.get('author_name', 'Unknown')}")
    except Exception as e:
        logger.warning("Failed to fetch YouTube oEmbed: %s", e)

    # 2. Get transcript
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        ytt = YouTubeTranscriptApi()
        transcript = ytt.fetch(video_id)
        transcript_text = " ".join(entry.text for entry in transcript)
        transcript_text = transcript_text.replace("\xa0", " ")
        if len(transcript_text) > 50000:
            transcript_text = transcript_text[:50000] + "\n\n[Transcript truncated — video is very long]"
        parts.append(f"\nTranscript:\n{transcript_text}")
    except Exception as e:
        logger.warning("Failed to fetch YouTube transcript: %s", e)
        try:
            resp = httpx.get(url, follow_redirects=True, timeout=15.0)
            desc_match = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', resp.text)
            if desc_match:
                parts.append(f"\nDescription: {desc_match.group(1)}")
        except Exception:
            pass

    if parts:
        return "\n".join(parts)
    return f"YouTube video (ID: {video_id}) — unable to extract content. Try pasting the video transcript manually."


def _fetch_image_content(url: str) -> str:
    """Handle image URLs — note: Groq doesn't support vision, return description request."""
    try:
        resp = httpx.get(url, timeout=15.0, follow_redirects=True)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")

        if "image" not in content_type and not any(url.lower().endswith(ext) for ext in IMAGE_EXTENSIONS):
            return f"URL does not point to an image (content-type: {content_type})"

        return (
            f"Image from: {url}\n\n"
            f"[Image detected — Groq does not support image analysis. "
            f"For image summarization, use Google Gemini or paste the image description manually.]"
        )
    except Exception as e:
        return f"Unable to process image: {str(e)}"


def _is_image_url(url: str) -> bool:
    parsed = urlparse(url)
    return any(parsed.path.lower().endswith(ext) for ext in IMAGE_EXTENSIONS)


def fetch_url_content(url: str) -> str:
    """Detect content type and extract meaningful content from a URL."""
    parsed = urlparse(url)

    # YouTube
    video_id = _extract_youtube_id(url)
    if video_id:
        logger.info("Detected YouTube video: %s", video_id)
        return _fetch_youtube_content(url, video_id)

    # Images
    if _is_image_url(url):
        logger.info("Detected image URL")
        return _fetch_image_content(url)

    # Regular web pages / articles
    try:
        response = httpx.get(url, follow_redirects=True, timeout=15.0)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")

        final_path = urlparse(str(response.url)).path.lower()
        if any(final_path.endswith(ext) for ext in IMAGE_EXTENSIONS):
            return _fetch_image_content(str(response.url))

        if "text/html" in content_type:
            from html.parser import HTMLParser

            class ArticleExtractor(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.result = []
                    self.skip = False
                    self.tag_stack = []

                def handle_starttag(self, tag, attrs):
                    self.tag_stack.append(tag)
                    if tag in ("script", "style", "noscript", "nav", "footer", "header"):
                        self.skip = True
                    if tag in ("h1", "h2", "h3"):
                        self.result.append("\n## ")
                    if tag == "p":
                        self.result.append("\n")
                    if tag == "li":
                        self.result.append("\n- ")

                def handle_endtag(self, tag):
                    if self.tag_stack and self.tag_stack[-1] == tag:
                        self.tag_stack.pop()
                    if tag in ("script", "style", "noscript", "nav", "footer", "header"):
                        self.skip = False
                    if tag in ("h1", "h2", "h3"):
                        self.result.append("\n")
                    if tag == "p":
                        self.result.append("\n")

                def handle_data(self, data):
                    if not self.skip:
                        text = data.strip()
                        if text:
                            self.result.append(text)

            parser = ArticleExtractor()
            parser.feed(response.text)
            content = "\n".join(parser.result)
            content = re.sub(r"\n{3,}", "\n\n", content).strip()
            if len(content) > 100:
                return content[:12000]
            desc_match = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', response.text)
            if desc_match:
                return f"Page: {url}\n\n{desc_match.group(1)}"
            return content[:12000] if content else f"Page loaded but no readable text found at: {url}"

        if "application/pdf" in content_type:
            return f"PDF document at: {url}\n\n[PDF detected — download and paste the text content for summarization]"

        return response.text[:12000]

    except Exception as e:
        return f"Unable to fetch content from URL: {str(e)}"


def _mock_summary(content: str, instruction: str | None = None, mode: str | None = None) -> str:
    """Fallback summary when the API is unavailable."""
    word_count = len(content.split())

    lines = [l.strip() for l in content.split("\n") if l.strip()]
    title_line = lines[0] if lines else "Content"
    if title_line.startswith("Title:"):
        title_line = title_line.replace("Title:", "").strip()

    sentences = [s.strip() for s in content.replace("\n", " ").split(".") if s.strip() and len(s.strip()) > 20][:12]
    key_points = "\n".join(f"1. **{s.strip()}**." for s in sentences[:6])
    additional = "\n".join(f"- {s.strip()}." for s in sentences[6:12])

    result = f"""# {title_line}

## Overview

This content contains approximately **{word_count} words** covering the topic above.

## Key Concepts Covered

{key_points if key_points else "1. Content received for detailed analysis."}

## Additional Points

{additional if additional else "- Further details would be expanded with a live API connection."}

## Note

This is a **basic extraction** because the AI API is currently unavailable.
Get a free Groq API key at **[console.groq.com](https://console.groq.com)** — no credit card needed,
14,400 requests/day free.
"""
    if mode and mode in SUMMARY_MODES:
        result += f"\n## Mode\n\n**{SUMMARY_MODES[mode]['label']}**\n\n*This mode will be fully applied once the API is connected.*\n"
    if instruction:
        result += f"\n## Your Instructions\n\n{instruction}\n\n*These instructions will be applied once the API is connected.*\n"

    return result
