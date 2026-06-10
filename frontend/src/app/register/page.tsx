"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleRegister = async () => {
    if (!username || !password || !email) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email }),
      });

      const data = await response.json();

      if (data.message) {
        setMessage("Code sent! Redirecting to verification...");
        setTimeout(() => {
          router.push(`/verify?username=${username}`);
        }, 1500);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch {
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md">

        <h1 className="text-3xl font-bold text-white mb-2 text-center">
          Register
        </h1>

        <p className="text-slate-400 text-center mb-6 text-sm">
          Create your account to get started
        </p>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white"
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRegister()}
          className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white"
        />

        {message && (
          <p className="text-center mb-4 text-green-400">{message}</p>
        )}

        {error && (
          <p className="text-center mb-4 text-red-400">{error}</p>
        )}

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white py-3 rounded-lg"
        >
          {loading ? "Sending code..." : "Register"}
        </button>

        <button
          onClick={() => router.push("/login")}
          className="w-full mt-3 bg-slate-600 hover:bg-slate-700 text-white py-3 rounded-lg"
        >
          Back to Login
        </button>

      </div>
    </main>
  );
}