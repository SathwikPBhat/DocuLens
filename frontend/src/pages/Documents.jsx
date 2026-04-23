import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const normalize = (value) => (value || "").trim().toLowerCase().replace(/\s+/g, " ");

function Documents() {
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState({
    search: "",
    searchInside: false,
    tags: [],
    fileType: "all",
    datePreset: "all",
    sort: "newest",
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((prev) => ({ ...prev, search: normalize(searchInput) }));
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/documents/", {
          params: {
            q: query.search,
            search_inside: query.searchInside ? "1" : "0",
            tags: query.tags.join(","),
            file_type: query.fileType,
            date: query.datePreset,
            sort: query.sort,
            page: page,
          },
        });

        const data = res.data;
        if (data.results) {
          setDocuments(Array.isArray(data.results) ? data.results : []);
          setTotalPages(Math.ceil((data.count || 0) / 6));
        } else {
          setDocuments(Array.isArray(data) ? data : []);
          setTotalPages(1);
        }
      } catch {
        setError("Failed to load documents.");
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [query, page]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => documents.some((doc) => doc.id === id)));
  }, [documents]);

  const allTags = useMemo(() => {
    const tagSet = new Set();

    documents.forEach((doc) => {
      (doc.tags || []).forEach((tag) => {
        const normalized = normalize(tag);
        if (normalized) tagSet.add(normalized);
      });
    });

    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const visibleDocuments = documents;

  const allVisibleSelected =
    visibleDocuments.length > 0 &&
    visibleDocuments.every((doc) => selectedIds.includes(doc.id));

  const formatDate = (value) => {
    if (!value) return "";
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  };

  const getFileKind = (doc) => {
    const raw = `${doc?.file_type || ""} ${doc?.file || ""} ${doc?.filename || ""}`.toLowerCase();

    if (raw.includes("pdf") || raw.endsWith(".pdf")) return "pdf";
    if (raw.includes("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(raw)) return "image";
    if (raw.includes("word") || /\.(doc|docx)$/i.test(raw)) return "doc";

    return "other";
  };

  const getFileLabel = (doc) => {
    const kind = getFileKind(doc);
    if (kind === "pdf") return "PDF";
    if (kind === "image") return "Image";
    if (kind === "doc") return "Doc";
    return "File";
  };

  const getFileTone = (doc) => {
    const kind = getFileKind(doc);
    if (kind === "pdf") return "bg-red-50 text-red-700 ring-red-100";
    if (kind === "image") return "bg-sky-50 text-sky-700 ring-sky-100";
    if (kind === "doc") return "bg-indigo-50 text-indigo-700 ring-indigo-100";
    return "bg-slate-50 text-slate-700 ring-slate-200";
  };

  const addTagFilter = (rawTag) => {
    const tag = normalize(rawTag);
    if (!tag) return;

    setQuery((prev) => {
      if (prev.tags.includes(tag)) return prev;
      return { ...prev, tags: [...prev.tags, tag] };
    });
    setPage(1);
  };

  const removeTagFilter = (rawTag) => {
    const tag = normalize(rawTag);
    setQuery((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
    setPage(1);
  };

  const clearAllFilters = () => {
    setSearchInput("");
    setQuery({
      search: "",
      searchInside: false,
      tags: [],
      fileType: "all",
      datePreset: "all",
      sort: "newest",
    });
    setPage(1);
  };

  const toggleSelected = (docId) => {
    setSelectedIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId],
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = visibleDocuments.map((doc) => doc.id);

    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleSingleDelete = async (docId, event) => {
    event.stopPropagation();

    const confirmed = window.confirm("Delete this document?");
    if (!confirmed) return;

    try {
      setDeletingId(docId);
      setError("");

      await api.delete(`/documents/${docId}/`);

      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
      setSelectedIds((prev) => prev.filter((id) => id !== docId));
    } catch {
      setError("Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(`Delete ${selectedIds.length} selected document(s)?`);
    if (!confirmed) return;

    try {
      setBulkDeleting(true);
      setError("");

      await api.post("/documents/bulk-delete/", { ids: selectedIds });

      setDocuments((prev) => prev.filter((doc) => !selectedIds.includes(doc.id)));
      setSelectedIds([]);
    } catch {
      setError("Failed to delete selected documents.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const hasActiveFilters =
    query.search ||
    query.searchInside ||
    query.tags.length > 0 ||
    query.fileType !== "all" ||
    query.datePreset !== "all";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),_transparent_30%),linear-gradient(to_bottom,_#f8fafc,_#eef2f7)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
            Document Library
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            All Documents
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Page {page} of {totalPages}
          </p>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <input
              type="text"
              placeholder="Search filename, tags, extracted text..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="md:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />

            <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={query.searchInside}
                onChange={(e) =>
                  setQuery((prev) => ({ ...prev, searchInside: e.target.checked }))
                }
              />
              Search inside document
            </label>

            <select
              value={query.fileType}
              onChange={(e) => {
                setQuery((prev) => ({ ...prev, fileType: e.target.value }));
                setPage(1);
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="all">All file types</option>
              <option value="pdf">PDF</option>
              <option value="image">Image</option>
              <option value="doc">Doc</option>
            </select>

            <select
              value={query.datePreset}
              onChange={(e) => {
                setQuery((prev) => ({ ...prev, datePreset: e.target.value }));
                setPage(1);
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="all">All dates</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>

            <select
              value={query.sort}
              onChange={(e) => {
                setQuery((prev) => ({ ...prev, sort: e.target.value }));
                setPage(1);
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
              Tags (AND)
            </span>

            {allTags.length === 0 && (
              <span className="text-xs text-slate-400">No tags available</span>
            )}

            {allTags.map((tag) => {
              const active = query.tags.includes(tag);

              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setQuery((prev) =>
                      active
                        ? { ...prev, tags: prev.tags.filter((t) => t !== tag) }
                        : { ...prev, tags: [...prev.tags, tag] },
                    );
                    setPage(1);
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {query.search && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  search: {query.search} ×
                </button>
              )}

              {query.searchInside && (
                <button
                  type="button"
                  onClick={() => setQuery((prev) => ({ ...prev, searchInside: false }))}
                  className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                >
                  inside text ×
                </button>
              )}

              {query.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTagFilter(tag)}
                  className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                >
                  {tag} ×
                </button>
              ))}

              {query.fileType !== "all" && (
                <button
                  type="button"
                  onClick={() => setQuery((prev) => ({ ...prev, fileType: "all" }))}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  type: {query.fileType} ×
                </button>
              )}

              {query.datePreset !== "all" && (
                <button
                  type="button"
                  onClick={() => setQuery((prev) => ({ ...prev, datePreset: "all" }))}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  date: {query.datePreset} ×
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>

        {!loading && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-2 text-sm text-slate-700"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                />
                Select visible
              </label>

              <span className="text-sm text-slate-500">
                {visibleDocuments.length} result(s)
              </span>
            </div>

            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedIds.length === 0 || bulkDeleting}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkDeleting ? "Deleting..." : `Delete selected (${selectedIds.length})`}
            </button>
          </div>
        )}

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm"
              >
                <div className="h-4 w-20 rounded bg-slate-200" />
                <div className="mt-4 h-6 w-3/4 rounded bg-slate-200" />
                <div className="mt-3 h-4 w-1/2 rounded bg-slate-200" />
                <div className="mt-6 h-7 w-24 rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && visibleDocuments.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center shadow-sm">
            <h2 className="text-lg font-medium text-slate-900">
              No documents match your query
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Try clearing some filters or broadening your search.
            </p>
          </div>
        )}

        {!loading && !error && visibleDocuments.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleDocuments.map((doc) => {
              const badgeTone = getFileTone(doc);
              const fileLabel = getFileLabel(doc);

              return (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") navigate(`/documents/${doc.id}`);
                  }}
                  className="group cursor-pointer text-left outline-none"
                >
                  <article className="h-full rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badgeTone}`}
                      >
                        {fileLabel}
                      </div>

                      <label
                        className="flex items-center gap-2 text-xs text-slate-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(doc.id)}
                          onChange={() => toggleSelected(doc.id)}
                        />
                        Select
                      </label>
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                      {formatDate(doc.uploaded_at)}
                    </div>

                    <h2 className="mt-3 line-clamp-2 text-[15px] font-semibold leading-6 tracking-tight text-slate-900">
                      {doc.title}
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      {doc.file_type || "Unknown type"}
                    </p>

                    {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {doc.tags.slice(0, 6).map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addTagFilter(tag);
                            }}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-sm font-medium text-slate-700">Open</span>

                      <button
                        type="button"
                        onClick={(e) => handleSingleDelete(doc.id, e)}
                        disabled={deletingId === doc.id}
                        className="rounded-full px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === doc.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && visibleDocuments.length > 0 && (
          <div className="mt-8 flex justify-between items-center">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>

            <span className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages || totalPages === 0}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Documents;