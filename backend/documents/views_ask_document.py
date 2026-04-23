from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers
from rest_framework.views import APIView

from .models import Document
from .services.document_qa import answer_document_question


class AskDocumentSerializer(serializers.Serializer):
    document_id = serializers.IntegerField(min_value=1)
    question = serializers.CharField(min_length=1, max_length=2000, trim_whitespace=True)


class AskDocumentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = AskDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document = get_object_or_404(
            Document.objects.only("id", "extracted_text").filter(user=request.user),
            pk=serializer.validated_data["document_id"],
        )

        extracted_text = (document.extracted_text or "").strip()
        if not extracted_text:
            return HttpResponse(
                "Document has no readable content",
                content_type="text/plain",
                status=200,
            )

        try:
            # Pass document_id for caching
            answer = answer_document_question(
                document.id,
                extracted_text,
                serializer.validated_data["question"],
            )
        except Exception:
            return HttpResponse(
                "AI service temporarily unavailable",
                content_type="text/plain",
                status=503,
            )

        return HttpResponse(answer, content_type="text/plain", status=200)