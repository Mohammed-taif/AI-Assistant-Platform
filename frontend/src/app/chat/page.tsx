"use client";

import {
  useEffect,
  useState,
  useRef,
} from "react";

import ReactMarkdown from "react-markdown";

import { Copy } from "lucide-react";

import { Prism as SyntaxHighlighter }
from "react-syntax-highlighter";

import { oneDark }
from "react-syntax-highlighter/dist/esm/styles/prism";

import { useRouter }
from "next/navigation";

import {
  sendMessage,
  getConversations,
  getConversation,
  deleteConversation,
} from "@/services/api";

export default function ChatPage() {

  const router = useRouter();

  const stopRef =
    useRef(false);

  const [messages, setMessages] =
    useState<any[]>([]);

  const [input, setInput] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [isStreaming, setIsStreaming] =
    useState(false);

  const [conversations, setConversations] =
    useState<any[]>([]);

  const [conversationId, setConversationId] =
    useState<number | null>(null);

  const bottomRef =
    useRef<HTMLDivElement | null>(null);

  // AUTO SCROLL
  useEffect(() => {

    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });

  }, [messages]);

  // AUTH CHECK
  useEffect(() => {

    const token =
      localStorage.getItem("token");

    if (!token) {

      router.push("/login");
      return;
    }

    loadConversations();

  }, []);

  // LOAD CONVERSATIONS
  const loadConversations =
    async () => {

      const token =
        localStorage.getItem("token");

      if (!token) return;

      try {

        const data =
          await getConversations(token);

        setConversations(
          Array.isArray(data)
            ? data
            : []
        );

      } catch {

        console.log(
          "Conversation load failed"
        );
      }
    };

  // LOAD CHAT
  const loadConversation =
    async (id: number) => {

      const token =
        localStorage.getItem("token");

      if (!token) return;

      try {

        const data =
          await getConversation(
            id,
            token
          );

        setConversationId(id);

        setMessages(
          Array.isArray(data)
            ? data
            : []
        );

      } catch {

        console.log(
          "Chat load failed"
        );
      }
    };

  // NEW CHAT
  const handleNewChat = () => {

    setConversationId(null);
    setMessages([]);
  };

  // DELETE CHAT
  const handleDeleteConversation =
    async (id: number) => {

      const token =
        localStorage.getItem("token");

      if (!token) return;

      try {

        await deleteConversation(
          id,
          token
        );

        if (conversationId === id) {

          setConversationId(null);
          setMessages([]);
        }

        loadConversations();

      } catch {

        console.log(
          "Delete failed"
        );
      }
    };

  // LOGOUT
  const handleLogout = () => {

    localStorage.removeItem("token");

    localStorage.removeItem("username");

    router.push("/login");
  };

  // SEND MESSAGE
  const send = async () => {

    if (!input.trim()) return;

    const token =
      localStorage.getItem("token");

    if (!token) {

      router.push("/login");
      return;
    }

    stopRef.current = false;

    const userMessage = {
      role: "user",
      content: input,
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    const messageToSend = input;

    setInput("");

    // THINKING
    setLoading(true);

    try {

      const response =
        await sendMessage(
          messageToSend,
          token,
          conversationId || undefined
        );

      const reply =
        response.reply;

      let currentText = "";

      // ADD EMPTY AI MESSAGE
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
        },
      ]);

      // START STREAM
      setLoading(false);
      setIsStreaming(true);

      const words =
        reply.split(" ");

      for (
        let i = 0;
        i < words.length;
        i++
      ) {

        // STOP BUTTON
        if (stopRef.current)
          break;

        currentText +=
          (i === 0 ? "" : " ")
          + words[i];

        setMessages((prev) => {

          const updated = [...prev];

          updated[
            updated.length - 1
          ] = {
            role: "assistant",
            content: currentText,
          };

          return updated;
        });

        // SMOOTH FLOW
        await new Promise(
          (resolve) =>
            setTimeout(resolve, 35)
        );
      }

      setIsStreaming(false);

      // SAVE NEW CHAT
      if (!conversationId) {

        setConversationId(
          response.conversation_id
        );

        loadConversations();
      }

    } catch {

      setLoading(false);
      setIsStreaming(false);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Error: AI not responding",
        },
      ]);
    }
  };

  return (

    <main className="flex h-screen bg-slate-900">

      {/* SIDEBAR */}
      <div className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col">

        <div className="p-4 border-b border-slate-800">

          <button
            onClick={handleNewChat}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg"
          >
            + New Chat
          </button>

        </div>

        {/* CONVERSATIONS */}
        <div className="flex-1 overflow-y-auto">

          {conversations.map(
            (chat: any, index: number) => (

            <div
              key={chat.id}
              className="sidebar-chat flex items-center border-b border-slate-800"
            >

              <button
                onClick={() =>
                  loadConversation(chat.id)
                }
                className="flex-1 text-left p-4 text-white hover:bg-slate-800"
              >
                Chat #{index + 1}
              </button>

              <button
                onClick={() =>
                  handleDeleteConversation(chat.id)
                }
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
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">

          <h1 className="text-white text-xl font-bold">
            AI Chat Assistant
          </h1>

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
          >
            Logout
          </button>

        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {messages.map((msg, i) => (

            <div
              key={i}
              className={`message-fade p-3 rounded-xl max-w-[80%] text-white ${
                msg.role === "user"
                  ? "bg-blue-600 ml-auto"
                  : "bg-slate-700"
              }`}
            >

              <div className="prose prose-invert max-w-none">

                <ReactMarkdown

                  components={{

                    code(props) {

                      const {
                        children,
                        className,
                      } = props;

                      const match =
                        /language-(\w+)/.exec(
                          className || ""
                        );

                      const codeString =
                        String(children)
                          .replace(/\n$/, "");

                      return match ? (

                        <div className="relative">

                          {/* COPY */}
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(
                                codeString
                              )
                            }
                            className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white p-2 rounded"
                          >
                            <Copy size={16} />
                          </button>

                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                          >
                            {codeString}
                          </SyntaxHighlighter>

                        </div>

                      ) : (

                        <code className="bg-slate-800 px-1 py-0.5 rounded">
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

          {/* THINKING */}
          {loading && !isStreaming && (

            <div className="bg-slate-700 text-white p-3 rounded-xl w-fit animate-pulse">

              AI is thinking...

            </div>

          )}

          <div ref={bottomRef} />

        </div>

        {/* INPUT */}
        <div className="p-4 border-t border-slate-800 flex gap-2">

          <input
            type="text"
            value={input}
            onChange={(e) =>
              setInput(e.target.value)
            }
            onKeyDown={(e) =>
              e.key === "Enter" && send()
            }
            placeholder="Type a message..."
            className="flex-1 p-3 rounded-lg bg-slate-700 text-white outline-none"
          />

          {isStreaming ? (

            <button
              onClick={() => {

                stopRef.current = true;

                setLoading(false);
                setIsStreaming(false);
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-lg"
            >
              Stop
            </button>

          ) : (

            <button
              onClick={send}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg"
            >
              Send
            </button>

          )}

        </div>

      </div>

    </main>
  );
}