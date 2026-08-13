import { useState } from "react";
import { sendMessage } from "../api/aiApi";

export default function AIChatWidget({ trip, setActiveTrip }) {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "I’m VoyageAI. How can I help you customize your travel plan today? ✨",
    },
  ]);

  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || thinking) return;

    const userMessage = input;

    // Show user message instantly
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setInput("");
    setThinking(true);

    try {
      // 🔹 Ask Gemini backend, passing the trip ID for context
      const res = await sendMessage(userMessage, trip?._id);

      // Add AI reply to messages
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: res.reply || "😊 Here is what I generated for you!" },
      ]);

      // If the backend executed an action and updated the trip, sync it
      if (res.updatedTrip) {
        setActiveTrip(res.updatedTrip);
      }
    } catch (err) {
      console.error("AI error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "⚠️ Sorry, I had trouble processing that action. Please verify details and try again.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <section className="bg-slate-900 border border-white/5 rounded-2xl flex flex-col h-[280px] shadow-inner overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 text-xs font-semibold text-gray-200 border-b border-white/10 flex justify-between items-center bg-black/10">
        <span>🤖 AI Travel Assistant</span>
        <span className="text-[10px] text-sky-400 font-bold uppercase tracking-widest bg-sky-500/10 px-2 py-0.5 rounded">
          Active
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-xs">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`px-3 py-2 rounded-xl max-w-[85%] whitespace-pre-line leading-relaxed ${
              msg.role === "user"
                ? "ml-auto bg-sky-500/80 text-white font-medium shadow-sm"
                : "bg-white/10 text-white/90 border border-white/5"
            }`}
          >
            {msg.text}
          </div>
        ))}

        {thinking && (
          <div className="bg-white/5 border border-white/5 px-3 py-2 rounded-xl w-fit animate-pulse text-gray-400 text-xs">
            VoyageAI is calculating...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-2 flex gap-1.5 bg-black/5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask AI to add restaurants, cheaper hotels, etc."
          className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-sky-500"
        />

        <button
          onClick={handleSend}
          disabled={thinking}
          className="px-3 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold transition"
        >
          Send
        </button>
      </div>
    </section>
  );
}
