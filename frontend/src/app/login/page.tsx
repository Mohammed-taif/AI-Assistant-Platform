"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.access_token) {
        // ✅ Save token and username to localStorage
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("username", username);

        router.push("/chat"); // redirect to chat page
      } else {
        // Show error from backend (e.g. "Invalid username" or "Invalid password")
        setMessage(data.error || "Login failed");
      }
    } catch (error) {
      setMessage("Server error");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md">

        <h1 className="text-3xl font-bold text-white mb-6 text-center">
          Login
        </h1>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white"
        />

        {message && (
          <p className="text-center mb-4 text-red-400">{message}</p>
        )}

        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
        >
          Login
        </button>

        <button
          onClick={() => router.push("/register")}
          className="w-full mt-3 bg-slate-600 hover:bg-slate-700 text-white py-3 rounded-lg"
        >
          Register
        </button>

      </div>
    </main>
  );
}