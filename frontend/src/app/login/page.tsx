"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/services/api";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      const data = await login(username, password);

      if (data.access_token) {
        localStorage.setItem(
          "token",
          data.access_token
        );

        router.push("/chat");
      } else {
        setError("Invalid credentials");
      }
    } catch (err) {
      setError("Login failed");
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
          onChange={(e) =>
            setUsername(e.target.value)
          }
          className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white"
        />

        {error && (
          <p className="text-red-400 mb-4">
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
        >
          Login
        </button>
      </div>
    </main>
  );
}