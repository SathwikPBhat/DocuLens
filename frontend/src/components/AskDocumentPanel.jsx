import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axios";

function formatTime(date) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function AskDocumentPanel({ documentId }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef(null);

  const safeDocumentId = useMemo(() => Number(documentId), [documentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  const closePanel = () => setOpen(false);

  const sendQuestion = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || loading || !safeDocumentId) return;

    const userMessage = {
      role: "user",
      text: trimmedQuestion,
      time: formatTime(new Date()),
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      // The backend returns plain text only, so we request text here.
      const res = await api.post(
        "/ask-document/",
        {
          document_id: safeDocumentId,
          question: trimmedQuestion,
        },
        {
          responseType: "text",
        },
      );

      const answerText =
        typeof res.data === "string" && res.data.trim()
          ? res.data.trim()
          : "Not found in document";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: answerText,
          time: formatTime(new Date()),
        },
      ]);
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        (typeof error?.response?.data === "string" ? error.response.data : "") ||
        "Unable to answer right now.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: message,
          time: formatTime(new Date()),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendQuestion();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 top-1/2 z-40 -translate-y-1/2 rounded-l-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 sm:right-0"
      >
        Ask
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close chatbot backdrop"
            onClick={closePanel}
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
          />

          <aside className="absolute right-0 top-0 flex h-dvh w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-105">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Ask this document</h2>
                <p className="text-xs text-slate-500">
                  Answers are based only on the selected document.
                </p>
              </div>

              <button
                type="button"
                onClick={closePanel}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close chatbot"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Ask a question about this document and I will answer only from its extracted
                  content.
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}-${message.time}`}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm ${
                          message.role === "user"
                            ? "bg-blue-600 text-white"
                            : message.error
                              ? "bg-red-50 text-red-700 ring-1 ring-red-100"
                              : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.text}</p>
                        <p
                          className={`mt-1 text-[11px] ${
                            message.role === "user" ? "text-blue-100" : "text-slate-400"
                          }`}
                        >
                          {message.time}
                        </p>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
                        Thinking...
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 p-4">
              <div className="flex items-end gap-2">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder="Ask about the document..."
                  className="min-h-12 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={sendQuestion}
                  disabled={loading || !question.trim()}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export default AskDocumentPanel;