from rest_framework import serializers
from .models import Document
from tags.models import Tag


def normalize_tag(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


class TagSlugOrCreateField(serializers.SlugRelatedField):
    def to_internal_value(self, data):
        value = normalize_tag(str(data))
        if not value:
            raise serializers.ValidationError("Tag cannot be empty.")

        existing = Tag.objects.filter(name__iexact=value).first()
        if existing:
            return existing
        return Tag.objects.create(name=value)


class DocumentSerializer(serializers.ModelSerializer):
    tags = TagSlugOrCreateField(
        many=True,
        slug_field="name",
        queryset=Tag.objects.all(),
        required=False,
    )
    filename = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "user",
            "title",
            "file",
            "filename",
            "uploaded_at",
            "extracted_text",
            "file_type",
            "file_size",
            "tags",
        ]
        read_only_fields = [
            "id",
            "user",
            "uploaded_at",
            "extracted_text",
            "file_type",
            "file_size",
            "filename",
        ]

    def get_filename(self, obj):
        return obj.filename()

    def validate_tags(self, value):
        seen = set()
        unique = []
        for tag in value:
            key = tag.name.lower()
            if key in seen:
                continue
            seen.add(key)
            unique.append(tag)
        return unique
    
class RelatedDocumentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    filename = serializers.CharField()
    uploaded_at = serializers.DateTimeField()
    file_type = serializers.CharField(allow_blank=True, required=False)
    file_size = serializers.IntegerField(allow_null=True, required=False)
    tags = serializers.ListField(child=serializers.CharField(), required=False)
    score = serializers.IntegerField()
    tag_overlap = serializers.IntegerField()
    text_overlap = serializers.IntegerField()

class StatisticsQuerySerializer(serializers.Serializer):
    interval = serializers.ChoiceField(choices=["day", "week"], default="day")
    top_tags = serializers.IntegerField(min_value=3, max_value=20, default=8)