import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import fitz
import pytesseract
from django.conf import settings
from django.db import close_old_connections
from PIL import Image

from documents.models import Document

logger = logging.getLogger(__name__)

OCR_EXECUTOR = ThreadPoolExecutor(max_workers=2)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".heic", ".heif"}
PDF_EXTENSIONS = {".pdf"}


def normalize_text(value):
    return " ".join((value or "").split()).strip()


def is_image_file(file_name, content_type=""):
    lowered_name = (file_name or "").lower()
    lowered_type = (content_type or "").lower()
    return lowered_type.startswith("image/") or Path(lowered_name).suffix in IMAGE_EXTENSIONS


def is_pdf_file(file_name, content_type=""):
    lowered_name = (file_name or "").lower()
    lowered_type = (content_type or "").lower()
    return lowered_type == "application/pdf" or Path(lowered_name).suffix in PDF_EXTENSIONS or "pdf" in lowered_type


def get_tesseract_language():
    return getattr(settings, "OCR_LANGUAGE", "eng")


def ocr_image_path(image_path):
    with Image.open(image_path) as image:
        image = image.convert("RGB")
        text = pytesseract.image_to_string(image, lang=get_tesseract_language())
        return normalize_text(text)


def extract_pdf_text(pdf_path):
    extracted_parts = []

    with fitz.open(pdf_path) as pdf_document:
        for page in pdf_document:
            page_text = page.get_text("text").strip()
            if page_text:
                extracted_parts.append(page_text)

    return normalize_text("\n".join(extracted_parts))


def ocr_pdf_pages(pdf_path):
    max_pages = int(getattr(settings, "OCR_MAX_PDF_OCR_PAGES", 50))

    extracted_parts = []
    with fitz.open(pdf_path) as pdf_document:
        page_count = min(len(pdf_document), max_pages)

        for index in range(page_count):
            page = pdf_document.load_page(index)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)

            mode = "RGB" if pixmap.n < 4 else "RGBA"
            image = Image.frombytes(mode, [pixmap.width, pixmap.height], pixmap.samples)
            if mode == "RGBA":
                image = image.convert("RGB")

            text = pytesseract.image_to_string(image, lang=get_tesseract_language())
            text = normalize_text(text)
            if text:
                extracted_parts.append(text)

    return normalize_text("\n".join(extracted_parts))


def process_document_extraction(document_id, use_ocr=False):
    close_old_connections()
    try:
        document = Document.objects.get(pk=document_id)
        file_path = document.file.path
        file_name = document.file.name
        content_type = document.file_type or ""

        if is_image_file(file_name, content_type):
            extracted_text = ocr_image_path(file_path)
        elif is_pdf_file(file_name, content_type):
            if use_ocr:
                # Explicit OCR mode for PDFs: skip embedded text extraction
                extracted_text = ocr_pdf_pages(file_path)
            else:
                extracted_text = extract_pdf_text(file_path)

        Document.objects.filter(pk=document_id).update(extracted_text=extracted_text)
    except Exception:
        logger.exception("OCR extraction failed for document %s", document_id)
        Document.objects.filter(pk=document_id).update(extracted_text="")
    finally:
        close_old_connections()


def schedule_document_extraction(document_id, use_ocr=False):
    OCR_EXECUTOR.submit(process_document_extraction, document_id, use_ocr)