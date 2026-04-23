from django.urls import path
from .views import (
    DocumentBulkDeleteView,
    DocumentDetailView,
    DocumentListCreateView,
    DocumentTagsUpdateView,
    TagSuggestionView,
    DocumentExtractTextView,
    DocumentRelatedView,
    DocumentStatisticsView,
)

from .views_ask_document import AskDocumentView

urlpatterns = [
    path("documents/", DocumentListCreateView.as_view(), name="documents-list-create"),
    path("documents/bulk-delete/", DocumentBulkDeleteView.as_view(), name="documents-bulk-delete"),
    path("documents/<int:pk>/", DocumentDetailView.as_view(), name="documents-detail"),
    path("documents/<int:pk>/tags/", DocumentTagsUpdateView.as_view(), name="documents-tags-update"),
    path("tags/suggestions/", TagSuggestionView.as_view(), name="tags-suggestions"),
    path("documents/<int:pk>/extract-text/", DocumentExtractTextView.as_view(), name="documents-extract-text"),
    path("documents/<int:pk>/related/", DocumentRelatedView.as_view(), name="documents-related"),
    path("analytics/statistics/", DocumentStatisticsView.as_view(), name="documents-statistics"),
    path("ask-document/", AskDocumentView.as_view(), name="ask-document"),
]