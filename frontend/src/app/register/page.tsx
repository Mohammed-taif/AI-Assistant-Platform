"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleRegister = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage("Registration successful!");

        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } else {
        setMessage(
          data.detail || "Registration failed"
        );
      }
    } catch (error) {
      setMessage("Server error");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md">

        <h1 className="text-3xl font-bold text-white mb-6 text-center">
          Register
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

        {message && (
          <p className="text-center mb-4 text-green-400">
            {message}
          </p>
        )}

        <button
          onClick={handleRegister}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg"
        >
          Register
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