import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axios";

const normalizeTag = (value) => value.trim().toLowerCase().replace(/\s+/g, " ");

function TagInput({
  value,
  onChange,
  filename = "",
  placeholder = "Add tags...",
  maxSuggestions = 7,
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);

  const normalizedSelected = useMemo(
    () => value.map((t) => normalizeTag(t)),
    [value],
  );

  useEffect(() => {
    const onClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query && !filename) {
        setSuggestions([]);
        return;
      }

      try {
        setLoading(true);
        const res = await api.get("/tags/suggestions/", {
          params: {
            q: query,
            filename,
            limit: maxSuggestions,
          },
        });

        const items = Array.isArray(res.data?.suggestions) ? res.data.suggestions : [];
        const names = items
          .map((item) => normalizeTag(item.name || ""))
          .filter(Boolean)
          .filter((name) => !normalizedSelected.includes(name));

        setSuggestions(names.slice(0, maxSuggestions));
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, filename, maxSuggestions, normalizedSelected]);

  const addTag = (rawTag) => {
    const tag = normalizeTag(rawTag);
    if (!tag) return;
    if (normalizedSelected.includes(tag)) return;

    onChange([...value, tag]);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  };

  const removeTag = (tag) => {
    const tagNorm = normalizeTag(tag);
    onChange(value.filter((item) => normalizeTag(item) !== tagNorm));
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        addTag(suggestions[activeIndex]);
      } else if (query.trim()) {
        addTag(query);
      }
      return;
    }

    if (e.key === "Backspace" && !query && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 focus-within:border-blue-500">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-slate-500 hover:text-slate-900"
            >
              ×
            </button>
          </span>
        ))}

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-w-[140px] flex-1 border-none p-0 text-sm outline-none"
        />
      </div>

      {open && (suggestions.length > 0 || loading || query.trim()) && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-500">Loading suggestions...</div>
          )}

          {!loading &&
            suggestions.map((tag, idx) => (
              <button
                key={tag}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(tag)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  idx === activeIndex ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tag}
              </button>
            ))}

          {!loading && query.trim() && !suggestions.includes(normalizeTag(query)) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(query)}
              className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50"
            >
              Create "{normalizeTag(query)}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TagInput;