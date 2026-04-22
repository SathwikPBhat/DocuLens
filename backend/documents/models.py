from django.db import models
from django.contrib.auth.models import User


class Document(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="documents")

    title = models.CharField(max_length=255)
    file = models.FileField(upload_to="documents/")

    uploaded_at = models.DateTimeField(auto_now_add=True)

    extracted_text = models.TextField(blank=True, null=True)

    file_type = models.CharField(max_length=255, blank=True)
    file_size = models.IntegerField(blank=True, null=True)

    tags = models.ManyToManyField("tags.Tag", related_name="documents", blank=True)
    class Meta:
        indexes = [
            models.Index(fields=["title"]),
        ]

    def filename(self):
        return self.file.name.split("/")[-1]
    
    def __str__(self):
        return self.title