"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/chat");
    } else {
      router.push("/login");
    }
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="text-white text-xl animate-pulse">Loading...</div>
    </main>
  );
}