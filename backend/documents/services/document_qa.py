import logging
import os
import re

from django.conf import settings
from django.core.cache import cache
import google.generativeai as genai

logger = logging.getLogger(__name__)

MAX_DOCUMENT_CONTEXT_CHARS = 30000
MAX_QUESTION_CHARS = 2000
DOCUMENT_CACHE_TTL = 3600  # Cache document for 1 hour per user


def normalize_whitespace(value):
    value = value or ""
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def safe_trim_text(value, max_chars):
    value = normalize_whitespace(value)
    if len(value) <= max_chars:
        return value

    trimmed = value[:max_chars]
    last_space = trimmed.rfind(" ")
    if last_space > max_chars * 0.8:
        trimmed = trimmed[:last_space]

    return trimmed.strip()


def get_cached_document_text(document_id, extracted_text):
    """
    Cache the document text so we don't resend it for every question.
    Cache key: 'doc_qa_{document_id}'
    """
    cache_key = f"doc_qa_{document_id}"
    cached = cache.get(cache_key)
    if cached:
        logger.info(f"Using cached document text for doc {document_id}")
        return cached

    # First time: normalize and cache
    processed = safe_trim_text(extracted_text, MAX_DOCUMENT_CONTEXT_CHARS)
    cache.set(cache_key, processed, DOCUMENT_CACHE_TTL)
    logger.info(f"Cached document text for doc {document_id}")
    return processed


def build_prompt(extracted_text, user_question):
    user_question = safe_trim_text(user_question, MAX_QUESTION_CHARS)

    return (
        "You are an AI assistant answering questions ONLY from the provided document.\n"
        "Do NOT use outside knowledge.\n"
        "If the answer is not explicitly present, respond with exactly: 'Not found in document'.\n\n"
        f"Document:\n{extracted_text}\n\n"
        f"Question:\n{user_question}\n\n"
        "Answer concisely and accurately."
    )


def answer_document_question(document_id, extracted_text, user_question):
    api_key = os.getenv("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    genai.configure(api_key=api_key)

    # Use cached document text instead of resending raw text every time
    cached_text = get_cached_document_text(document_id, extracted_text)
    
    model = genai.GenerativeModel("gemini-2.5-flash-lite")
    prompt = build_prompt(cached_text, user_question)

    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.0,
                "top_p": 1.0,
                "top_k": 1,
                "max_output_tokens": 256,
            },
        )
        answer = (getattr(response, "text", "") or "").strip()
        if not answer:
            return "Not found in document"

        return answer
    except Exception:
        logger.exception("Gemini document QA failed")
        raise