import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { getMessages, clearMessages } from "../api/groupChatService";
import { auth } from "../firebase";

const BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");
const WS_URL = import.meta.env.VITE_WS_URL || BASE;

let socketInstance = null; // module-level singleton

function MemberAvatar({ name, photo }) {
  if (photo) return <img src={photo} alt={name} className="w-7 h-7 rounded-full border border-white/10 object-cover flex-shrink-0" />;
  const initials = (name || "?").charAt(0).toUpperCase();
  const colors = ["bg-sky-600", "bg-indigo-600", "bg-violet-600", "bg-emerald-600", "bg-rose-600"];
  const ci = (initials.charCodeAt(0) || 0) % colors.length;
  return (
    <div className={`w-7 h-7 rounded-full ${colors[ci]} flex items-center justify-center font-black text-white text-xs flex-shrink-0`}>
      {initials}
    </div>
  );
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return ""; }
}

function GroupChatModal({ trip, isOpen, onClose, onAskAI }) {
  const { user } = useAuth();
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [connected, setConnected] = useState(false);
  const [sending,   setSending]   = useState(false);
  const [clearing,  setClearing]  = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const members     = (trip?.participants || []).filter(p => p.status === "accepted");
  const memberCount = members.length;

  const loadHistory = useCallback(async () => {
    if (!trip?._id) return;
    setLoading(true);
    try {
      const msgs = await getMessages(trip._id);
      setMessages(msgs);
    } catch (e) { console.error("GroupChat history error:", e); }
    finally { setLoading(false); }
  }, [trip?._id]);

  // ── Socket Connection Lifecycle ──────────────────────
  useEffect(() => {
    if (!trip?._id || !isOpen) return;

    const connect = async () => {
      if (WS_URL.includes("vercel.app")) {
        console.info("ℹ️ Vercel deployment detected. Socket.io disabled; falling back to REST polling.");
        setConnected(false);
        return;
      }
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        if (!socketInstance || socketInstance.disconnected) {
          socketInstance = io(WS_URL, {
            auth: { token },
            transports: ["websocket", "polling"],
            reconnectionAttempts: 3,
            timeout: 5000,
          });
        }

        socketInstance.on("connect", () => {
          setConnected(true);
          socketInstance.emit("join_trip", trip._id);
        });

        socketInstance.on("disconnect", () => setConnected(false));
        socketInstance.on("connect_error", () => setConnected(false));

        socketInstance.on("group_message", (msg) => {
          setMessages(prev => {
            const filtered = prev.filter(m => !m._id?.startsWith("opt-"));
            return [...filtered, msg];
          });
        });

        // ── Handle remote clear ──────────────────────
        socketInstance.on("clear_chat", () => {
          setMessages([]);
        });
      } catch (e) { console.error("Socket connect error:", e); }
    };

    connect();
    loadHistory();

    return () => {
      if (socketInstance) {
        socketInstance.off("group_message");
        socketInstance.off("connect");
        socketInstance.off("disconnect");
        socketInstance.off("connect_error");
        socketInstance.off("clear_chat");
        socketInstance.emit("leave_trip", trip._id);
      }
    };
  }, [trip?._id, isOpen, loadHistory]);

  // ── Polling Fallback (polls every 5s if socket is offline/serverless) ──
  useEffect(() => {
    if (!trip?._id || !isOpen || connected) return;

    const interval = setInterval(async () => {
      try {
        const msgs = await getMessages(trip._id);
        setMessages(msgs);
      } catch (e) {
        console.warn("Polling fallback failed:", e.message);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [trip?._id, isOpen, connected]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending || !trip?._id) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const optimistic = {
      _id:         `opt-${Date.now()}`,
      senderId:    user?.uid,
      senderName:  user?.displayName || "You",
      senderPhoto: user?.photoURL || "",
      message:     text,
      createdAt:   new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE}/api/group-chat/${trip._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error("Send failed");
    } catch (e) {
      console.error("Send error:", e);
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    if (!trip?._id) { setMessages([]); return; }
    if (!confirm("Clear all group chat history for this trip?")) return;
    setClearing(true);
    try {
      await clearMessages(trip._id);
      setMessages([]);
    } catch {
      setMessages([]);
    } finally {
      setClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[550] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6 sm:pr-[460px]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 sm:bg-transparent" />

      <div
        className="relative z-10 w-full sm:w-[400px] bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ height: "clamp(400px, 60vh, 620px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-gradient-to-r from-emerald-900/30 to-teal-900/30 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-sm shadow-lg shadow-emerald-500/30">💬</div>
            <div>
              <p className="text-sm font-black text-white">Trip Chat</p>
              <p className="text-[10px] text-emerald-400/80">
                {memberCount} member{memberCount !== 1 ? "s" : ""}
                {connected ? <span className="text-emerald-400"> · Live</span> : <span className="text-gray-500"> · Offline</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Clear chat */}
            <button
              onClick={handleClear}
              disabled={clearing || messages.length === 0}
              title="Clear chat history"
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 flex items-center justify-center text-sm transition disabled:opacity-30"
            >
              🗑
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center text-sm transition">✕</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading && <div className="text-center text-xs text-gray-500 animate-pulse py-2">Loading messages...</div>}

          {!loading && messages.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-sm font-bold text-gray-500">No messages yet</p>
              <p className="text-xs mt-1">Start the conversation!</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isMe     = msg.senderId === user?.uid;
            const showName = !isMe && (i === 0 || messages[i - 1]?.senderId !== msg.senderId);
            const showAvat = !isMe && (i === 0 || messages[i - 1]?.senderId !== msg.senderId);

            return (
              <div key={msg._id || i} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                <div className="flex-shrink-0 w-7">
                  {!isMe && showAvat && <MemberAvatar name={msg.senderName} photo={msg.senderPhoto} />}
                </div>
                <div className={`max-w-[75%] space-y-0.5 flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  {showName && <p className="text-[10px] text-gray-500 px-1">{msg.senderName}</p>}
                  <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                    isMe
                      ? "bg-gradient-to-br from-sky-500 to-indigo-500 text-white rounded-tr-sm"
                      : "bg-white/8 border border-white/8 text-gray-200 rounded-tl-sm"
                  }`}>
                    {msg.message}
                  </div>
                  <div className={`flex items-center gap-1.5 px-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="text-[9px] text-gray-600">{formatTime(msg.createdAt)}</span>
                    {!isMe && onAskAI && (
                      <button onClick={() => onAskAI(msg.message)}
                        className="text-[9px] text-sky-500/60 hover:text-sky-400 transition font-bold" title="Ask VoyageAI">
                        ✨ Ask AI
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/8 p-3 flex gap-2 bg-slate-950/50 flex-shrink-0">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Type a message..."
            className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupChatModal;
