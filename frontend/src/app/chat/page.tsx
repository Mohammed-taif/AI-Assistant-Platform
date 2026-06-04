"use client";

import {
  useEffect,
  useState,
  useRef,
} from "react";

import { useRouter } from "next/navigation";

import {
  sendMessage,
  getConversations,
  getConversation,
  deleteConversation,
} from "@/services/api";

export default function ChatPage() {

  const router = useRouter();

  const [messages, setMessages] =
    useState<any[]>([]);

  const [input, setInput] =
    useState("");

  const [loading, setLoading] =
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

  // LOAD CONVERSATIONS
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {

    const token =
      localStorage.getItem("token");

    if (!token) return;

    try {

      const data =
        await getConversations(token);

      setConversations(data);

    } catch (error) {

      console.error(
        "Failed to load conversations"
      );
    }
  };

  // LOAD SINGLE CHAT
  const loadConversation = async (
    id: number
  ) => {

    const token =
      localStorage.getItem("token");

    if (!token) return;

    try {

      const data =
        await getConversation(id, token);

      setConversationId(id);

      setMessages(
        Array.isArray(data)
          ? data
          : data.messages || []
      );

    } catch (error) {

      console.error(
        "Failed to load conversation"
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

      } catch (error) {

        console.error(
          "Failed to delete conversation"
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

    if (!token) return;

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

    setLoading(true);

    try {

      const response =
        await sendMessage(
          messageToSend,
          token,
          conversationId || undefined
        );

      const aiMessage = {
        role: "assistant",
        content: response.reply,
      };

      setMessages((prev) => [
        ...prev,
        aiMessage,
      ]);

      // STORE NEW CONVERSATION
      if (!conversationId) {

        setConversationId(
          response.conversation_id
        );

        loadConversations();
      }

    } catch (error) {

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Error: AI not responding",
        },
      ]);
    }

    setLoading(false);
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

        {/* CHAT LIST */}
        <div className="flex-1 overflow-y-auto">

          {conversations.map((chat: any) => (

            <div
              key={chat.id}
              className="flex items-center border-b border-slate-800"
            >

              <button
                onClick={() =>
                  loadConversation(chat.id)
                }
                className="flex-1 text-left p-4 text-white hover:bg-slate-800"
              >
                Chat #{chat.id - 1}
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

          <h1 className="text-white font-bold text-xl">
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
              className={`p-3 rounded-xl max-w-[80%] text-white ${
                msg.role === "user"
                  ? "bg-blue-600 ml-auto"
                  : "bg-slate-700"
              }`}
            >
              <p className="whitespace-pre-wrap">
                {msg.content}
              </p>
            </div>

          ))}

          {loading && (

            <div className="bg-slate-700 text-white p-3 rounded-xl w-fit">
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

          <button
            onClick={send}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg"
          >
            Send
          </button>

        </div>
      </div>
    </main>
  );
}