import re
from django.contrib.auth.models import User
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Document
from collections import Counter
from pathlib import Path
from django.db.models.functions import TruncDay, TruncWeek
from .serializers import (
    DocumentSerializer,
    normalize_tag,
    RelatedDocumentSerializer,
    StatisticsQuerySerializer,
)
from .services.related_documents import get_related_documents
from tags.models import Tag
from datetime import timedelta
from django.db.models import Q
from django.utils import timezone
from django.db import transaction
from .services.ocr import schedule_document_extraction

def normalize_query(value):
    return " ".join((value or "").strip().lower().split())

def parse_bool(value):
    return str(value).strip().lower() in {"1", "true", "yes", "on"}

class DocumentListCreateView(generics.ListCreateAPIView):
    queryset = Document.objects.select_related("user").prefetch_related("tags").order_by("-uploaded_at")
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = Document.objects.select_related("user").prefetch_related("tags").filter(user=self.request.user)

        search = normalize_query(self.request.query_params.get("q"))
        search_inside = normalize_query(self.request.query_params.get("search_inside", "false")) in {
            "1",
            "true",
            "yes",
            "on",
        }
        tags_raw = self.request.query_params.get("tags", "")
        tags = [normalize_query(tag) for tag in tags_raw.split(",") if normalize_query(tag)]
        file_type = normalize_query(self.request.query_params.get("file_type", "all"))
        date_preset = normalize_query(self.request.query_params.get("date", "all"))
        sort = normalize_query(self.request.query_params.get("sort", "newest"))

        if search:
            search_q = (
                Q(title__icontains=search)
                | Q(file__icontains=search)
                | Q(file_type__icontains=search)
                | Q(tags__name__icontains=search)
            )

            if search_inside:
                search_q |= Q(extracted_text__icontains=search)

            queryset = queryset.filter(search_q)

        for tag in tags:
            queryset = queryset.filter(tags__name__iexact=tag)

        if file_type == "pdf":
            queryset = queryset.filter(Q(file_type__icontains="pdf") | Q(file__iendswith=".pdf"))
        elif file_type == "image":
            queryset = queryset.filter(
                Q(file_type__startswith="image/")
                | Q(file__iendswith=".png")
                | Q(file__iendswith=".jpg")
                | Q(file__iendswith=".jpeg")
                | Q(file__iendswith=".webp")
                | Q(file__iendswith=".gif")
                | Q(file__iendswith=".bmp")
                | Q(file__iendswith=".svg")
            )
        elif file_type == "doc":
            queryset = queryset.filter(
                Q(file_type__icontains="word")
                | Q(file_type__icontains="document")
                | Q(file__iendswith=".doc")
                | Q(file__iendswith=".docx")
            )

        if date_preset in {"7d", "30d", "90d"}:
            days = int(date_preset[:-1])
            cutoff = timezone.now() - timedelta(days=days)
            queryset = queryset.filter(uploaded_at__gte=cutoff)

        if sort == "oldest":
            queryset = queryset.order_by("uploaded_at", "id")
        elif sort == "name_asc":
            queryset = queryset.order_by("title", "id")
        elif sort == "name_desc":
            queryset = queryset.order_by("-title", "-id")
        else:
            queryset = queryset.order_by("-uploaded_at", "-id")

        return queryset.distinct()

    def perform_create(self, serializer):
        uploaded_file = self.request.FILES.get("file")
        if not uploaded_file:
            raise ValidationError({"file": "File is required."})

        title = self.request.data.get("title") or uploaded_file.name

        if self.request.user and self.request.user.is_authenticated:
            user = self.request.user
        else:
            user = User.objects.first()
            if not user:
                user = User.objects.create_user(username="demo_uploader")

        document = serializer.save(
            user=self.request.user,
            title=title,
            file_type=(uploaded_file.content_type or "")[:255],
            file_size=uploaded_file.size,
        )

        use_ocr = parse_bool(self.request.data.get("use_ocr"))
        transaction.on_commit(lambda: schedule_document_extraction(document.pk, use_ocr=use_ocr))

class DocumentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Document.objects.select_related("user").prefetch_related("tags")
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_destroy(self, instance):
        if instance.file:
            instance.file.delete(save=False)
        instance.delete()


class DocumentTagsUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        instance = get_object_or_404(
            Document.objects.select_related("user").prefetch_related("tags"),
            pk=pk,
        )
        serializer = DocumentSerializer(
            instance,
            data={"tags": request.data.get("tags", [])},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(DocumentSerializer(instance).data, status=status.HTTP_200_OK)


class BulkDeleteSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )


class DocumentBulkDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ids = serializer.validated_data["ids"]
        docs = list(Document.objects.filter(id__in=ids))
        found_ids = {doc.id for doc in docs}
        missing_ids = [doc_id for doc_id in ids if doc_id not in found_ids]

        for doc in docs:
            if doc.file:
                doc.file.delete(save=False)

        deleted_count, _ = Document.objects.filter(id__in=found_ids).delete()

        return Response(
            {
                "deleted_count": deleted_count,
                "missing_ids": missing_ids,
            },
            status=status.HTTP_200_OK,
        )


class TagSuggestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _extract_content_tags(filename):
        tokens = re.split(r"[^a-zA-Z0-9]+", (filename or "").lower())
        stopwords = {"the", "and", "for", "final", "copy", "file", "document", "doc"}
        result = []
        seen = set()
        for token in tokens:
            token = normalize_tag(token)
            if len(token) < 3 or token.isdigit() or token in stopwords or token in seen:
                continue
            seen.add(token)
            result.append(token)
        return result

    def get(self, request):
        query = normalize_tag(request.query_params.get("q", ""))
        filename = request.query_params.get("filename", "")
        limit = min(int(request.query_params.get("limit", 7)), 10)

        content_candidates = self._extract_content_tags(filename)

        recent_docs = (
            Document.objects.prefetch_related("tags")
            .order_by("-uploaded_at")[:25]
        )
        recent_tags = []
        recent_seen = set()
        for doc in recent_docs:
            for tag_name in doc.tags.values_list("name", flat=True):
                normalized = normalize_tag(tag_name)
                if normalized and normalized not in recent_seen:
                    recent_seen.add(normalized)
                    recent_tags.append(normalized)

        popular_qs = (
            Tag.objects.annotate(doc_count=Count("documents"))
            .order_by("-doc_count", "name")[:50]
        )
        popular_map = {}
        for tag in popular_qs:
            popular_map[normalize_tag(tag.name)] = tag.doc_count

        query_candidates = []
        if query:
            query_candidates = [
                normalize_tag(name)
                for name in Tag.objects.filter(name__icontains=query)
                .values_list("name", flat=True)[:25]
            ]

        candidates = set(content_candidates) | set(recent_tags) | set(popular_map.keys()) | set(query_candidates)

        scored = []
        for candidate in candidates:
            if not candidate:
                continue

            score = 0
            if candidate in content_candidates:
                score += 5
            if query and (candidate.startswith(query) or query in candidate):
                score += 4
            if candidate in recent_seen:
                score += 3
            if candidate in popular_map:
                score += 1

            if query and score == 0:
                continue

            scored.append(
                {
                    "name": candidate,
                    "score": score,
                    "popularity": popular_map.get(candidate, 0),
                }
            )

        scored.sort(key=lambda item: (-item["score"], -item["popularity"], item["name"]))
        top = scored[:limit]

        return Response({"suggestions": top}, status=status.HTTP_200_OK)

class DocumentExtractTextView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        document = get_object_or_404(Document, pk=pk)
        use_ocr = parse_bool(request.data.get("use_ocr"))

        # Async trigger; response is immediate.
        schedule_document_extraction(document.pk, use_ocr=use_ocr)

        return Response(
            {"detail": "Text extraction started."},
            status=status.HTTP_202_ACCEPTED,
        )
    
class DocumentRelatedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        document = get_object_or_404(
            Document.objects.select_related("user").prefetch_related("tags"),
            pk=pk,
        )

        try:
            limit = int(request.query_params.get("limit", 5))
        except (TypeError, ValueError):
            limit = 5

        limit = max(1, min(limit, 10))

        related = get_related_documents(document, limit=limit)
        serializer = RelatedDocumentSerializer(related, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class DocumentStatisticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query_serializer = StatisticsQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)

        interval = query_serializer.validated_data["interval"]
        top_tags = query_serializer.validated_data["top_tags"]

        trunc_fn = TruncWeek if interval == "week" else TruncDay

        upload_qs = (
            Document.objects.annotate(period=trunc_fn("uploaded_at"))
            .values("period")
            .annotate(count=Count("id"))
            .order_by("period")
        )
        upload_activity = [
            {
                "period": row["period"].date().isoformat() if row["period"] else "",
                "count": row["count"],
            }
            for row in upload_qs
        ]

        tag_qs = (
            Tag.objects.annotate(count=Count("documents"))
            .filter(count__gt=0)
            .order_by("-count", "name")[:top_tags]
        )
        tag_distribution = [{"name": tag.name, "count": tag.count} for tag in tag_qs]

        docs = Document.objects.only("file", "file_type", "extracted_text")
        total_documents = docs.count()

        file_type_counter = Counter()
        extracted_count = 0

        for doc in docs.iterator():
            raw_name = (doc.file.name or "").lower()
            ext = Path(raw_name).suffix
            mime = (doc.file_type or "").lower()

            if "pdf" in mime or ext == ".pdf":
                bucket = "PDF"
            elif mime.startswith("image/") or ext in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg", ".tif", ".tiff"}:
                bucket = "Image"
            elif "word" in mime or ext in {".doc", ".docx"}:
                bucket = "Doc"
            elif "spreadsheet" in mime or ext in {".xls", ".xlsx", ".csv"}:
                bucket = "Sheet"
            else:
                bucket = "Other"

            file_type_counter[bucket] += 1

            if (doc.extracted_text or "").strip():
                extracted_count += 1

        file_type_breakdown = [{"name": name, "count": count} for name, count in file_type_counter.items()]
        file_type_breakdown.sort(key=lambda x: (-x["count"], x["name"]))

        without_extracted = max(total_documents - extracted_count, 0)
        ocr_coverage = {
            "with_extracted_text": extracted_count,
            "without_extracted_text": without_extracted,
            "percentage_with_extracted_text": round((extracted_count / total_documents) * 100, 2) if total_documents else 0.0,
        }

        unorganized_documents = Document.objects.filter(tags__isnull=True).count()

        payload = {
            "kpis": {
                "total_documents": total_documents,
                "organized_documents": max(total_documents - unorganized_documents, 0),
                "unorganized_documents": unorganized_documents,
                "search_ready_documents": extracted_count,
            },
            "upload_activity": upload_activity,
            "tag_distribution": tag_distribution,
            "file_type_breakdown": file_type_breakdown,
            "ocr_coverage": ocr_coverage,
        }

        return Response(payload, status=status.HTTP_200_OK)