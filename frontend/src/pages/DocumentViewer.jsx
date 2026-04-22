import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import TagInput from "../components/TagInput";

function DocumentViewer() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [document, setDocument] = useState(null);
  const [tags, setTags] = useState([]);
  const [savingTags, setSavingTags] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [useOcrForExtraction, setUseOcrForExtraction] = useState(false);

  const [relatedDocuments, setRelatedDocuments] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState("");

  const backendOrigin = useMemo(() => api.defaults.baseURL.replace("/api", ""), []);

  const fileUrl = useMemo(() => {
    if (!document?.file) return "";
    if (document.file.startsWith("http")) return document.file;
    return `${backendOrigin}${document.file}`;
  }, [document, backendOrigin]);

  const fetchDocument = async () => {
    const res = await api.get(`/documents/${id}/`);
    setDocument(res.data);
    setTags(Array.isArray(res.data?.tags) ? res.data.tags : []);
    return res.data;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const doc = await fetchDocument();

        if (
          doc?.file_type?.toLowerCase().startsWith("image/") ||
          /\.(png|jpe?g|webp|gif|bmp|svg|tif|tiff)$/i.test(doc?.file || "")
        ) {
          setUseOcrForExtraction(true);
        } else {
          setUseOcrForExtraction(false);
        }
      } catch {
        setError("Failed to load document.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  useEffect(() => {
    let active = true;

    const loadRelated = async () => {
      try {
        setRelatedLoading(true);
        setRelatedError("");

        const res = await api.get(`/documents/${id}/related/`, {
          params: { limit: 5 },
        });

        if (!active) return;
        setRelatedDocuments(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!active) return;
        setRelatedError("Failed to load related documents.");
      } finally {
        if (active) setRelatedLoading(false);
      }
    };

    loadRelated();

    return () => {
      active = false;
    };
  }, [id]);

  const formatDate = (value) => {
    if (!value) return "";
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isPdf = () => {
    const type = (document?.file_type || "").toLowerCase();
    const name = (document?.file || "").toLowerCase();
    return type.includes("pdf") || name.endsWith(".pdf");
  };

  const isImage = () => {
    const type = (document?.file_type || "").toLowerCase();
    const name = (document?.file || "").toLowerCase();
    return type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg|tif|tiff)$/i.test(name);
  };

  useEffect(() => {
    if (!document || (!isPdf() && !isImage())) {
      setPreviewUrl("");
      setPreviewError("");
      setPreviewLoading(false);
      return;
    }

    let active = true;
    let objectUrl = "";

    const loadPreview = async () => {
      try {
        setPreviewLoading(true);
        setPreviewError("");

        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Preview fetch failed");

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (active) setPreviewUrl(objectUrl);
      } catch {
        if (active) setPreviewError("Failed to load preview.");
      } finally {
        if (active) setPreviewLoading(false);
      }
    };

    loadPreview();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document, fileUrl]);

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this document?");
    if (!confirmed) return;

    try {
      setDeleting(true);
      await api.delete(`/documents/${id}/`);
      navigate("/documents");
    } catch {
      setError("Failed to delete document.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveTags = async () => {
    try {
      setSavingTags(true);
      const res = await api.patch(`/documents/${id}/tags/`, { tags });
      setDocument(res.data);
      setTags(Array.isArray(res.data?.tags) ? res.data.tags : tags);
    } catch {
      setError("Failed to save tags.");
    } finally {
      setSavingTags(false);
    }
  };

  const pollForExtractedText = async () => {
    const maxAttempts = 20;
    const delayMs = 1500;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const latest = await api.get(`/documents/${id}/`);
        if ((latest.data?.extracted_text || "").trim()) {
          window.location.reload();
          return;
        }
      } catch {
        // transient poll errors ignored
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    setExtractError("Extraction is still running or failed. Please try again in a few moments.");
    setExtracting(false);
  };

  const handleExtractText = async () => {
    try {
      setExtracting(true);
      setExtractError("");

      await api.post(`/documents/${id}/extract-text/`, {
        use_ocr: useOcrForExtraction,
      });

      await pollForExtractedText();
    } catch {
      setExtracting(false);
      setExtractError("Failed to start extraction.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="mb-6 h-8 w-64 rounded bg-slate-200" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-[70vh] rounded-2xl bg-white shadow-sm" />
            <div className="h-[70vh] rounded-2xl bg-white shadow-sm" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!document) return null;

  const showExtractAction = !(document.extracted_text || "").trim();

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,_#f8fafc,_#eef2f7)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate("/documents")}
              className="mb-3 text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              ← Back to documents
            </button>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {document.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {document.file_type || "Unknown type"} • {formatSize(document.file_size)}
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href={fileUrl}
              rel="noreferrer"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Download
            </a>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="min-h-[65vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {isPdf() || isImage() ? (
                previewLoading ? (
                  <div className="flex h-[65vh] items-center justify-center text-sm text-slate-500">
                    Loading preview...
                  </div>
                ) : previewError ? (
                  <div className="flex h-[65vh] items-center justify-center p-6 text-center">
                    <div>
                      <p className="text-lg font-medium text-slate-900">Failed to load preview</p>
                      <p className="mt-2 text-sm text-slate-500">Use download/open file to view it.</p>
                    </div>
                  </div>
                ) : isPdf() ? (
                  <iframe src={previewUrl} title={document.title} className="h-[65vh] w-full" />
                ) : (
                  <div className="flex h-[65vh] items-center justify-center bg-slate-50 p-4">
                    <img src={previewUrl} alt={document.title} className="max-h-full max-w-full object-contain" />
                  </div>
                )
              ) : (
                <div className="flex h-[65vh] items-center justify-center p-6 text-center">
                  <div>
                    <p className="text-lg font-medium text-slate-900">Preview not available for this file type</p>
                    <p className="mt-2 text-sm text-slate-500">Use download/open file to view it.</p>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Related Documents
              </h2>

              {relatedLoading && (
                <p className="mt-3 text-sm text-slate-500">Loading related documents...</p>
              )}

              {!relatedLoading && relatedError && (
                <p className="mt-3 text-sm text-red-600">{relatedError}</p>
              )}

              {!relatedLoading && !relatedError && relatedDocuments.length === 0 && (
                <p className="mt-3 text-sm text-slate-500">No related documents found.</p>
              )}

              {!relatedLoading && !relatedError && relatedDocuments.length > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {relatedDocuments.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(`/documents/${item.id}`)}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100"
                    >
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.filename}</p>

                      {Array.isArray(item.tags) && item.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.tags.slice(0, 4).map((tag) => (
                            <span
                              key={`${item.id}-${tag}`}
                              className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Metadata
              </h2>

              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-slate-500">Upload date</dt>
                  <dd className="mt-1 font-medium text-slate-900">{formatDate(document.uploaded_at)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">File type</dt>
                  <dd className="mt-1 font-medium text-slate-900">{document.file_type || "Unknown"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">File size</dt>
                  <dd className="mt-1 font-medium text-slate-900">{formatSize(document.file_size)}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Tags
              </h2>
              <div className="mt-3">
                <TagInput
                  value={tags}
                  onChange={setTags}
                  filename={document.filename || document.title || ""}
                  placeholder="Add or update tags"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveTags}
                disabled={savingTags}
                className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {savingTags ? "Saving..." : "Save tags"}
              </button>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Extracted Text
              </h2>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {showExtractAction ? (
                  <div className="space-y-3">
                    {(isImage() || isPdf()) && (
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={useOcrForExtraction}
                          onChange={(e) => setUseOcrForExtraction(e.target.checked)}
                        />
                        {isImage()
                          ? "Run OCR on image"
                          : "Run OCR for PDF (otherwise text extraction library only)"}
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={handleExtractText}
                      disabled={extracting}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {extracting ? "Extracting..." : "Extract text"}
                    </button>

                    {extractError && <p className="text-sm text-red-600">{extractError}</p>}

                    {extracting && (
                      <p className="text-sm text-slate-500">
                        Extraction started. Waiting for completion...
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="max-h-80 overflow-auto">
                    <pre className="whitespace-pre-wrap font-sans">{document.extracted_text}</pre>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default DocumentViewer;