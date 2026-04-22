import re
from typing import List, Dict

from django.db.models import Q

from documents.models import Document


STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "else", "for", "to", "of", "in",
    "on", "at", "by", "with", "from", "is", "are", "was", "were", "be", "been", "being",
    "this", "that", "these", "those", "it", "its", "as", "not", "no", "yes", "do", "does",
    "did", "done", "can", "could", "should", "would", "will", "shall", "you", "your",
    "we", "our", "they", "their", "he", "she", "his", "her", "them", "us"
}


def normalize_text(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def extract_keywords(value: str, max_chars: int = 12000) -> set:
    text = normalize_text(value)[:max_chars]
    tokens = re.findall(r"[a-z0-9]{3,}", text)
    return {token for token in tokens if token not in STOPWORDS}


def get_related_documents(current_document: Document, limit: int = 5) -> List[Dict]:
    current_tags = {
        tag.strip().lower()
        for tag in current_document.tags.values_list("name", flat=True)
        if tag and tag.strip()
    }
    current_keywords = extract_keywords(current_document.extracted_text or "")

    candidates = (
        Document.objects.exclude(pk=current_document.pk)
        .select_related("user")
        .prefetch_related("tags")
    )

    if current_document.user_id:
        candidates = candidates.filter(user_id=current_document.user_id)

    # Performance guard: compare against likely candidates first.
    # Tag overlap is primary signal; text is secondary.
    if current_tags:
        candidates = candidates.filter(
            Q(tags__name__in=list(current_tags)) | Q(extracted_text__isnull=False)
        ).distinct()
    else:
        candidates = candidates.filter(extracted_text__isnull=False)

    scored = []
    for candidate in candidates:
        candidate_tags = {
            tag.strip().lower()
            for tag in candidate.tags.values_list("name", flat=True)
            if tag and tag.strip()
        }
        tag_overlap = len(current_tags & candidate_tags)
        tag_score = tag_overlap * 5

        text_overlap = 0
        text_score = 0
        if current_keywords and candidate.extracted_text:
            candidate_keywords = extract_keywords(candidate.extracted_text)
            text_overlap = len(current_keywords & candidate_keywords)
            text_score = min(text_overlap, 30)

        total_score = tag_score + text_score
        if total_score <= 0:
            continue

        scored.append(
            {
                "document": candidate,
                "score": total_score,
                "tag_overlap": tag_overlap,
                "text_overlap": text_overlap,
            }
        )

    scored.sort(
        key=lambda item: (
            -item["score"],
            -item["tag_overlap"],
            -item["text_overlap"],
            -(item["document"].uploaded_at.timestamp() if item["document"].uploaded_at else 0),
        )
    )

    top = scored[:limit]
    payload = []
    for item in top:
        doc = item["document"]
        payload.append(
            {
                "id": doc.id,
                "title": doc.title,
                "filename": doc.filename(),
                "uploaded_at": doc.uploaded_at,
                "file_type": doc.file_type,
                "file_size": doc.file_size,
                "tags": list(doc.tags.values_list("name", flat=True)),
                "score": item["score"],
                "tag_overlap": item["tag_overlap"],
                "text_overlap": item["text_overlap"],
            }
        )
    return payload