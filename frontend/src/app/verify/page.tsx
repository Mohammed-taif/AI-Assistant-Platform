"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ✅ Separate component that uses useSearchParams
function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const username = searchParams.get("username") || "";

  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleVerify = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, code }),
      });

      const data = await response.json();

      if (data.message) {
        setMessage("✅ Account verified! Redirecting to login...");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError(data.error || "Verification failed");
      }
    } catch {
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (data.message) {
        setMessage("📧 New code sent to your email!");
      } else {
        setError(data.error || "Failed to resend");
      }
    } catch {
      setError("Server error");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md">

      <div className="text-center mb-6">
        <div className="text-5xl mb-3">📧</div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Verify Email
        </h1>
        <p className="text-slate-400 text-sm">
          Enter the 6-digit code sent to your email
        </p>
        <p className="text-blue-400 text-sm mt-1 font-medium">
          Username: {username}
        </p>
      </div>

      <input
        type="text"
        placeholder="000000"
        value={code}
        maxLength={6}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && handleVerify()}
        className="w-full p-4 mb-4 rounded-lg bg-slate-700 text-white text-center text-3xl tracking-widest font-bold outline-none"
      />

      <p className="text-slate-500 text-xs text-center mb-4">
        ⏱ Code expires in 5 minutes
      </p>

      {message && (
        <p className="text-center mb-4 text-green-400">{message}</p>
      )}

      {error && (
        <p className="text-center mb-4 text-red-400">{error}</p>
      )}

      <button
        onClick={handleVerify}
        disabled={loading || code.length !== 6}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white py-3 rounded-lg mb-3 font-medium"
      >
        {loading ? "Verifying..." : "Verify Account"}
      </button>

      <button
        onClick={handleResend}
        disabled={resending}
        className="w-full bg-slate-600 hover:bg-slate-700 text-white py-3 rounded-lg mb-3"
      >
        {resending ? "Sending..." : "📨 Resend Code"}
      </button>

      <button
        onClick={() => router.push("/register")}
        className="w-full bg-transparent border border-slate-600 hover:border-slate-400 text-slate-400 py-3 rounded-lg"
      >
        Back to Register
      </button>

    </div>
  );
}

// ✅ Main page wraps form in Suspense
export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900">
      <Suspense fallback={
        <div className="text-white text-xl">Loading...</div>
      }>
        <VerifyForm />
      </Suspense>
    </main>
  );
}