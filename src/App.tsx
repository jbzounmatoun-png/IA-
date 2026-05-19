import React, { useState, useEffect, useRef } from "react";
import {
  Heart,
  Send,
  Lock,
  Trash2,
  RefreshCw,
  Sparkles,
  Smile,
  Info
} from "lucide-react";

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUser, setCurrentUser] = useState<"Jean-Baptiste" | "Merveille">("Jean-Baptiste");
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // Fetch conversations
  const fetchMessages = async () => {
    try {
      const response = await fetch("/api/messages");
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Auto-sync conversation log every 5 seconds to keep thoughts aligned
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || isSending) return;

    setIsSending(true);
    setInputText("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: currentUser, content: textToSend })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        if (textToSend === "🤞🏻" || textToSend === "🤞") {
          showToast("🤞🏻 wiki love love", "success");
        }
      } else {
        showToast("Impossible d'envoyer le message.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erreur réseau.", "error");
    } finally {
      setIsSending(false);
    }
  };

  const clearChatHistory = async () => {
    if (!window.confirm("Voulez-vous supprimer tout l'historique de discussion ?")) return;
    setIsResetting(true);
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.db.messages);
        showToast("Discussions réinitialisées", "success");
      }
    } catch (err) {
      console.error(err);
      showToast("Erreur lors du nettoyage.", "error");
    } finally {
      setIsResetting(false);
    }
  };

  // Helper formatting helper
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col justify-between selection:bg-rose-500/30 selection:text-neutral-50 relative overflow-hidden">
      
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-rose-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-10 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Elegant Toast Alert */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-6 py-2.5 rounded-full border bg-neutral-900/90 border-rose-500/20 shadow-2xl animate-bounce">
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
          <span className="text-xs font-medium text-neutral-200">{toast.message}</span>
        </div>
      )}

      {/* Title Header */}
      <header className="border-b border-white/5 py-4 px-6 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/15">
              <span className="text-lg font-serif italic text-white font-bold">W</span>
            </div>
            <div>
              <h1 className="font-serif text-lg tracking-tight text-neutral-100 font-semibold" id="app-title">
                Wiki Love
              </h1>
              <p className="text-[10px] text-neutral-500">
                L'IA Mentor de <span className="text-rose-400 font-medium">Merveille</span> & <span className="text-amber-300 font-medium">Jean-Baptiste</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Slogan Demo Hint */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-950/20 text-xs border border-rose-500/2d text-rose-200 italic font-serif">
              <span>Slogan : 🤞🏻</span>
            </div>

            <button
              onClick={clearChatHistory}
              disabled={isResetting}
              className="p-2 rounded-full hover:bg-red-950/30 text-neutral-500 hover:text-red-400 transition-colors border border-transparent hover:border-red-900/10"
              title="Vider la discussion"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Messaging Canvas Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-6 py-6 flex flex-col justify-between" id="chat-frame">
        
        {/* Dynamic Partner Selective Device Indicator */}
        <div className="flex flex-col items-center mb-6">
          <p className="text-[11px] text-neutral-400 mb-2.5 flex items-center gap-1 text-center justify-center">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Simulez vos téléphones portables respectifs :
          </p>
          <div className="bg-neutral-900 p-1 rounded-2xl border border-white/5 flex gap-1 shadow-inner">
            <button
              onClick={() => setCurrentUser("Jean-Baptiste")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                currentUser === "Jean-Baptiste"
                  ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              📱 Portable de Jean-Baptiste
            </button>
            <button
              onClick={() => setCurrentUser("Merveille")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                currentUser === "Merveille"
                  ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              📱 Portable de Merveille
            </button>
          </div>
        </div>

        {/* Minimal Smart Info Panel */}
        <div className="mb-4 text-center text-[10px] text-neutral-500 bg-neutral-900/30 py-2 border-y border-white/5 flex items-center justify-center gap-2">
          <Lock className="w-3 h-3 text-rose-400" />
          <span>Wiki Love garde en cœur vos échanges pour guider vos ressentis de façon confidentielle et très brève.</span>
        </div>

        {/* Message Streams Frame */}
        <div className="flex-1 min-h-[380px] md:min-h-[460px] bg-neutral-900/35 border border-white/5 rounded-2xl p-4 md:p-6 overflow-y-auto space-y-4 mb-4 select-text">
          {messages.map((msg) => {
            const isAi = msg.sender === "AI";
            const isSystem = msg.sender === "Système";
            
            // To provide a real individual phone experience: 
            // In Jean-Baptiste's device flow, we show his messages + AI answers.
            // In Merveille's device flow, we show her messages + AI answers.
            // System notices are shown on both devices securely.
            if (!isAi && !isSystem && msg.sender !== currentUser) {
              return null;
            }

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center py-1 text-[10px] text-rose-300/85">
                  ✦ {msg.content}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isAi ? "self-start" : "self-end ml-auto"}`}
              >
                {/* Micro sender name label */}
                <span className={`text-[9px] mb-1 font-semibold tracking-wider uppercase px-2 ${
                  isAi ? "text-rose-400" : currentUser === "Jean-Baptiste" ? "text-amber-300 self-end" : "text-rose-300 self-end"
                }`}>
                  {isAi ? "Wiki Love (Votre Mentor)" : msg.sender}
                </span>

                {/* Bubble content */}
                <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                  isAi
                    ? "bg-neutral-900 text-neutral-200 rounded-tl-none border border-white/5 shadow-md"
                    : currentUser === "Jean-Baptiste"
                      ? "bg-gradient-to-tr from-amber-700/80 to-amber-600/90 text-neutral-100 rounded-tr-none shadow"
                      : "bg-gradient-to-tr from-rose-700/80 to-rose-600/90 text-neutral-100 rounded-tr-none shadow"
                }`}>
                  {msg.content}
                </div>

                {/* Timestamp */}
                <span className={`text-[8px] text-neutral-600 mt-1 px-1 ${isAi ? "text-left" : "text-right"}`}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            );
          })}

          {/* Typing/Thinking loaders state */}
          {isSending && (
            <div className="flex flex-col max-w-[80%] self-start">
              <span className="text-[9px] text-rose-400 mb-1 font-semibold tracking-wider uppercase px-1">
                Wiki Love écrit...
              </span>
              <div className="p-3 bg-neutral-900 border border-white/5 text-xs text-neutral-400 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}

          {/* Anchor view helpers */}
          <div ref={chatEndRef} />
        </div>

        {/* Action input form container on simulator */}
        <div className="bg-neutral-900 p-2.5 rounded-2xl border border-white/5">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            
            {/* Direct Slogan Shortcut Icon Tap button */}
            <button
              type="button"
              onClick={() => {
                setInputText("🤞🏻");
                showToast("Slogan inséré ! Appuyez sur Envoyer.");
              }}
              className="px-3.5 rounded-xl bg-neutral-950 text-neutral-400 hover:text-white border border-white/5 hover:border-white/10 active:scale-95 transition-all flex items-center justify-center text-sm font-serif"
              title="Insérer le slogan complice"
            >
              🤞🏻
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Écrivez à Wiki Love en tant que ${currentUser === "Jean-Baptiste" ? "Jean-Baptiste" : "Merveille"}...`}
              className="flex-1 bg-neutral-950 text-xs px-3.5 py-3 rounded-xl border border-white/5 focus:outline-none focus:border-rose-500 text-neutral-200 transition-colors"
              disabled={isSending}
            />

            <button
              type="submit"
              className="px-4 py-3 rounded-xl bg-rose-600 text-white hover:bg-rose-500 hover:scale-[1.03] active:scale-95 transition-all text-xs flex items-center justify-center shadow disabled:opacity-50"
              disabled={isSending || !inputText.trim()}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Tiny prompt suggestions based on user directions */}
          <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap gap-1.5 items-center justify-start max-w-full">
            <span className="text-[8px] uppercase tracking-wider text-neutral-500 font-bold pr-1">Raccourcis :</span>
            <button
              type="button"
              onClick={() => setInputText("Quels conseils aurais-tu pour nous aujourd'hui ?")}
              className="text-[9px] bg-neutral-950 hover:bg-neutral-900 border border-white/5 hover:border-rose-500 px-2 py-1 rounded text-neutral-400"
            >
              Conseils généraux
            </button>
            <button
              type="button"
              onClick={() => setInputText("Donne-nous une question de couple Gottman pour briser la glace ce soir.")}
              className="text-[9px] bg-neutral-950 hover:bg-neutral-900 border border-white/5 hover:border-rose-500 px-2 py-1 rounded text-neutral-400"
            >
              Question rituelle
            </button>
            <button
              type="button"
              onClick={() => setInputText("🤞🏻")}
              className="text-[9px] bg-rose-950/20 hover:bg-rose-950/30 border border-rose-500/20 px-2.5 py-1 rounded text-rose-300 font-serif italic"
            >
              Slogan complice 🤞🏻
            </button>
          </div>
        </div>

      </main>

      {/* Brand footer bar */}
      <footer className="border-t border-white/5 py-4 px-6 text-center text-neutral-600 text-[10px] mt-6">
        <p>&copy; 2026 Wiki Love &bull; wiki love love &bull; Mentor Intime discret</p>
      </footer>

    </div>
  );
}
