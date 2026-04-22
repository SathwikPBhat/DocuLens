import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import TagInput from "../components/TagInput";

const isImageFile = (file) =>
  !!file &&
  (file.type.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|bmp|svg|tif|tiff)$/i.test(file.name));

const isPdfFile = (file) =>
  !!file &&
  (file.type === "application/pdf" || /\.pdf$/i.test(file.name));

function Dashboard() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [tags, setTags] = useState([]);
  const [useOcr, setUseOcr] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loadDocuments = useCallback(async () => {
    try {
      const res = await api.get("/documents/");
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError("Failed to load documents.");
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const onDrop = useCallback(
    (acceptedFiles) => {
      const picked = acceptedFiles[0];
      if (!picked) return;

      setFile(picked);
      setUseOcr(isImageFile(picked));
      if (!title) setTitle(picked.name);
      setError("");
    },
    [title],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please choose a file.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("title", title || file.name);
      formData.append("file", file);
      formData.append("use_ocr", String(useOcr));
      tags.forEach((tag) => formData.append("tags", tag));

      await api.post("/documents/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setFile(null);
      setTitle("");
      setTags([]);
      setUseOcr(false);
      await loadDocuments();
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h1 className="mb-4 text-xl font-semibold text-slate-800">Upload Document</h1>

          <form onSubmit={handleUpload} className="space-y-4">
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center ${
                isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
              }`}
            >
              <input {...getInputProps()} />
              <p className="text-sm text-slate-600">
                {file ? `Selected: ${file.name}` : "Drag and drop a file, or click to choose"}
              </p>
            </div>

            <input
              type="text"
              placeholder="Document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />

            {file && (isImageFile(file) || isPdfFile(file)) && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={useOcr}
                  onChange={(e) => setUseOcr(e.target.checked)}
                />
                {isImageFile(file)
                  ? "Run OCR on image"
                  : "Run OCR on PDF if needed"}
              </label>
            )}

            <TagInput
              value={tags}
              onChange={setTags}
              filename={file?.name || ""}
              placeholder="Add tags (type to get smart suggestions)"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={uploading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">Recent Documents</h2>

          <div className="space-y-3">
            {documents.length === 0 && (
              <p className="text-sm text-slate-500">No documents uploaded yet.</p>
            )}

            {documents.map((doc) => (
              <div key={doc.id} className="rounded-lg border border-slate-200 p-3">
                <p className="font-medium text-slate-800">{doc.title}</p>
                <p className="text-xs text-slate-500">
                  {doc.file_type || "Unknown type"} • {doc.file_size || 0} bytes
                </p>
                {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {doc.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                >
                  Open file
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;