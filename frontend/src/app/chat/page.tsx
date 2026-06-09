"use client";

import {
  useEffect,
  useState,
  useRef,
} from "react";

import ReactMarkdown from "react-markdown";
import { Copy } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useRouter } from "next/navigation";
import {
  sendMessage,
  getConversations,
  getConversation,
  deleteConversation,
  savePartial,
  transcribeAudio,
} from "@/services/api";

export default function ChatPage() {

  const router = useRouter();
  const stopRef = useRef(false);
  const conversationIdRef = useRef<number | null>(null);
  const currentTextRef = useRef("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [username, setUsername] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    setUsername(localStorage.getItem("username") || "User");
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const data = await getConversations(token);
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      console.log("Conversation load failed");
    }
  };

  const loadConversation = async (id: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const data = await getConversation(id, token);
      conversationIdRef.current = id;
      setConversationId(id);
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      console.log("Chat load failed");
    }
  };

  const handleNewChat = () => {
    conversationIdRef.current = null;
    setConversationId(null);
    setMessages([]);
  };

  const handleDeleteConversation = async (id: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await deleteConversation(id, token);
      if (conversationIdRef.current === id) {
        conversationIdRef.current = null;
        setConversationId(null);
        setMessages([]);
      }
      loadConversations();
    } catch {
      console.log("Delete failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.push("/login");
  };

  const startRecording = async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = true;
      recognition.start();
      setIsListening(true);
      (window as any)._recognition = recognition;

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput((prev) => prev + transcript);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const mimeType = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

        const mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const mimeUsed = mediaRecorder.mimeType || "audio/mp4";
          const extension = mimeUsed.includes("webm") ? "webm" : "mp4";
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeUsed });
          await handleTranscription(audioBlob, extension);
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start(100);
        setIsListening(true);

      } catch (err) {
        alert("Microphone access denied. Please allow microphone access.");
      }
    }
  };

  const stopRecording = () => {
  if ((window as any)._recognition) {
    (window as any)._recognition.stop();
    (window as any)._recognition = null;
    setIsListening(false);
    setIsTranscribing(false); // ✅ Web Speech doesn't need transcribing state
    return;
  }

  if (mediaRecorderRef.current && isListening) {
    mediaRecorderRef.current.stop();
  }

  setIsListening(false);
  setIsTranscribing(true);
};

  const handleTranscription = async (audioBlob: Blob, extension: string = "webm") => {
  const token = localStorage.getItem("token");

  // ✅ If blob is empty or too small, reset and bail out
  if (!token || audioBlob.size < 1000) {
    setIsTranscribing(false);
    return;
  }

  try {
    const data = await transcribeAudio(audioBlob, token, extension);
    if (data.text) {
      setInput((prev) => prev + data.text);
    }
  } catch {
    console.log("Transcription failed");
  } finally {
    // ✅ Always reset — no matter what happens
    setIsTranscribing(false);
    setIsListening(false);
  }
};

  const send = async () => {
    if (!input.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    stopRef.current = false;
    currentTextRef.current = "";

    setMessages((prev) => [...prev, { role: "user", content: input }]);
    const messageToSend = input;
    setInput("");
    setLoading(true);
    setIsStreaming(true);

    try {
      const currentConvId = conversationIdRef.current;
      const response = await sendMessage(messageToSend, token, currentConvId || undefined);

      if (stopRef.current) {
        setLoading(false);
        setIsStreaming(false);
        return;
      }

      const reply = response.reply;

      if (!currentConvId && response.conversation_id) {
        conversationIdRef.current = response.conversation_id;
        setConversationId(response.conversation_id);
        loadConversations();
      }

      let currentText = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      setLoading(false);

      const words = reply.split(" ");
      for (let i = 0; i < words.length; i++) {
        if (stopRef.current) break;

        currentText += (i === 0 ? "" : " ") + words[i];
        currentTextRef.current = currentText;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: currentText };
          return updated;
        });

        await new Promise((resolve) => setTimeout(resolve, 35));
      }

      setIsStreaming(false);

    } catch {
      setLoading(false);
      setIsStreaming(false);
      setMessages((prev) => [...prev, { role: "assistant", content: "Error: AI not responding" }]);
    }
  };

  return (
    <main className={`flex h-screen ${isDark ? "bg-slate-900" : "bg-gray-100"}`}>

      {/* SIDEBAR */}
      <div className={`w-72 ${isDark ? "bg-slate-950 border-slate-800" : "bg-white border-gray-200"} border-r flex flex-col`}>
        <div className={`p-4 border-b ${isDark ? "border-slate-800" : "border-gray-200"}`}>
          <button
            onClick={handleNewChat}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg"
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((chat: any, index: number) => (
            <div
              key={chat.id}
              className={`sidebar-chat flex items-center border-b ${isDark ? "border-slate-800" : "border-gray-200"}`}
            >
              <button
                onClick={() => loadConversation(chat.id)}
                className={`flex-1 text-left p-4 truncate ${isDark ? "text-white hover:bg-slate-800" : "text-gray-800 hover:bg-gray-100"}`}
              >
                {chat.title || `Chat #${index + 1}`}
              </button>
              <button
                onClick={() => handleDeleteConversation(chat.id)}
                className="text-red-400 px-3"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col">

        {/* HEADER */}
        <div className={`p-4 border-b ${isDark ? "border-slate-800" : "border-gray-200"} flex justify-between items-center`}>
          <div>
            <h1 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              AI Chat Assistant
            </h1>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
              Welcome, {username} 👋
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800"}`}
            >
              {isDark ? "☀️ Light" : "🌙 Dark"}
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
            >
              Logout
            </button>
          </div>
        </div>

        {/* MESSAGES */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isDark ? "bg-slate-900" : "bg-gray-50"}`}>

          {/* EMPTY STATE */}
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="text-6xl">🤖</div>
              <h2 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                How can I help you today?
              </h2>
              <p className={`text-sm max-w-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                Start a new conversation by typing or speaking a message below.
                Your previous chats are saved in the sidebar.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => setInput("Explain quantum computing simply")}
                  className={`${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-white hover:bg-gray-100 text-gray-800 border border-gray-200"} text-sm p-3 rounded-lg text-left`}
                >
                  💡 Explain quantum computing simply
                </button>
                <button
                  onClick={() => setInput("Write a Python function to sort a list")}
                  className={`${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-white hover:bg-gray-100 text-gray-800 border border-gray-200"} text-sm p-3 rounded-lg text-left`}
                >
                  🐍 Write a Python sorting function
                </button>
                <button
                  onClick={() => setInput("What are the best practices in DevOps?")}
                  className={`${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-white hover:bg-gray-100 text-gray-800 border border-gray-200"} text-sm p-3 rounded-lg text-left`}
                >
                  ⚙️ Best practices in DevOps
                </button>
                <button
                  onClick={() => setInput("Give me tips to improve my productivity")}
                  className={`${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-white hover:bg-gray-100 text-gray-800 border border-gray-200"} text-sm p-3 rounded-lg text-left`}
                >
                  🚀 Tips to improve productivity
                </button>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`message-fade p-3 rounded-xl max-w-[80%] w-fit ${
                msg.role === "user"
                  ? "bg-blue-600 text-white ml-auto"
                  : isDark
                  ? "bg-slate-700 text-white"
                  : "bg-white text-gray-900 border border-gray-200"
              }`}
            >
              <div className={`prose max-w-none ${isDark ? "prose-invert" : ""}`}>
                <ReactMarkdown
                  components={{
                    code(props) {
                      const { children, className } = props;
                      const match = /language-(\w+)/.exec(className || "");
                      const codeString = String(children).replace(/\n$/, "");
                      return match ? (
                        <div className="relative">
                          <button
                            onClick={() => navigator.clipboard.writeText(codeString)}
                            className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white p-2 rounded"
                          >
                            <Copy size={16} />
                          </button>
                          <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
                            {codeString}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className="bg-slate-800 px-1 py-0.5 rounded text-white">
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}

          {loading && (
            <div className={`p-3 rounded-xl w-fit animate-pulse ${isDark ? "bg-slate-700 text-white" : "bg-white text-gray-900 border border-gray-200"}`}>
              AI is thinking...
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* INPUT */}
        <div className={`p-4 border-t ${isDark ? "border-slate-800" : "border-gray-200"} flex gap-2 items-end`}>

          <textarea
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              isListening
                ? "🎤 Recording... click mic to stop"
                : isTranscribing
                ? "⏳ Transcribing..."
                : "Type a message or use 🎙️  (Shift+Enter for new line)"
            }
            className={`flex-1 p-3 rounded-lg outline-none resize-none overflow-y-auto max-h-40 min-h-[48px] ${isDark ? "bg-slate-700 text-white" : "bg-white text-gray-900 border border-gray-300"}`}
          />

          {/* BUTTONS — fixed size, never expand */}
          <div className="flex gap-2 flex-shrink-0">

            <button
              onClick={isListening ? stopRecording : startRecording}
              disabled={isTranscribing || isStreaming}
              title={isListening ? "Stop recording" : "Start voice input"}
              className={`h-[48px] w-[48px] flex items-center justify-center rounded-lg transition flex-shrink-0 ${
                isListening
                  ? "bg-red-500 animate-pulse text-white"
                  : isTranscribing
                  ? "bg-yellow-500 text-white"
                  : isDark
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-800"
              }`}
            >
              {isListening ? "⏹️" : isTranscribing ? "⏳" : "🎙️"}
            </button>

            {isStreaming ? (
              <button
                onClick={async () => {
                  stopRef.current = true;
                  setLoading(false);
                  setIsStreaming(false);
                  const token = localStorage.getItem("token");
                  const convId = conversationIdRef.current;
                  if (token && convId && currentTextRef.current) {
                    await savePartial(convId, currentTextRef.current, token);
                  }
                }}
                className="h-[48px] px-5 bg-red-600 hover:bg-red-700 text-white rounded-lg flex-shrink-0"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={send}
                className="h-[48px] px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex-shrink-0"
              >
                Send
              </button>
            )}

          </div>
        </div>

      </div>
    </main>
  );
}