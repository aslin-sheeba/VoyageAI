import { useState, useEffect, useRef } from "react";
import { sendMessage, getChatHistory, clearChatHistory } from "../api/aiApi";

const WELCOME = "✨ I'm VoyageAI. Ask me to tweak your itinerary, find places, or answer travel questions!";

export default function AIChatModal({ trip, setActiveTrip, isOpen, onClose }) {
  const [messages,       setMessages]       = useState([{ role: "ai", text: WELCOME }]);
  const [input,          setInput]          = useState("");
  const [thinking,       setThinking]       = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [clearing,       setClearing]       = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Load history when trip changes or modal opens
  useEffect(() => {
    if (!trip?._id) {
      setMessages([{ role: "ai", text: WELCOME }]);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    getChatHistory(trip._id).then(history => {
      if (cancelled) return;
      setMessages(history.length > 0 ? history : [{ role: "ai", text: WELCOME }]);
      setLoadingHistory(false);
    });
    return () => { cancelled = true; };
  }, [trip?._id]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const handleSend = async () => {
    if (!input.trim() || thinking) return;
    const text = input.trim();
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setThinking(true);
    try {
      const res = await sendMessage(text, trip?._id);
      setMessages(prev => [...prev, { role: "ai", text: res.reply || "✅ Done!" }]);
      if (res.updatedTrip) setActiveTrip(res.updatedTrip);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "⚠️ Something went wrong. Please try again." }]);
    } finally {
      setThinking(false);
    }
  };

  const handleClear = async () => {
    if (!trip?._id) { setMessages([{ role: "ai", text: WELCOME }]); return; }
    if (!confirm("Clear all AI chat history for this trip?")) return;
    setClearing(true);
    try {
      await clearChatHistory(trip._id);
      setMessages([{ role: "ai", text: WELCOME }]);
    } catch {
      // non-fatal – just clear UI
      setMessages([{ role: "ai", text: WELCOME }]);
    } finally {
      setClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 modal-scrim" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />

      {/* Modal */}
      <div
        className="modal-card relative z-10 w-full sm:w-[420px] bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ height: "clamp(400px, 60vh, 620px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-gradient-to-r from-sky-900/30 to-indigo-900/30 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-sm shadow-lg shadow-sky-500/30">✨</div>
            <div>
              <p className="text-sm font-black text-white">VoyageAI Assistant</p>
              {trip && <p className="text-[10px] text-sky-400/80">{trip.city} · {trip.days}d trip</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Clear history */}
            <button
              onClick={handleClear}
              disabled={clearing || messages.length <= 1}
              title="Clear chat history"
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 flex items-center justify-center text-sm transition disabled:opacity-30"
            >
              🗑
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center text-sm transition"
            >✕</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loadingHistory && (
            <div className="text-center text-xs text-gray-500 animate-pulse py-2">Loading conversation...</div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "ai" && (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-[10px] mr-2 flex-shrink-0 mt-0.5">✨</div>
              )}
              <div
                className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs whitespace-pre-line leading-relaxed ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-sky-500 to-indigo-500 text-white rounded-tr-sm"
                    : "bg-white/8 border border-white/8 text-gray-200 rounded-tl-sm"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-[10px]">✨</div>
              <div className="bg-white/8 border border-white/8 px-3.5 py-2.5 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/8 p-3 flex gap-2 bg-slate-950/50 flex-shrink-0">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask VoyageAI anything..."
            className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition"
          />
          <button
            onClick={handleSend}
            disabled={thinking || !input.trim()}
            className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-sky-500/20"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
