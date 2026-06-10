const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ✅ Helper to handle responses and catch 401
async function handleResponse(response: Response) {
  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  return response.json();
}

// LOGIN
export async function login(
  username: string,
  password: string
) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return response.json();
}

// SEND MESSAGE
export async function sendMessage(
  message: string,
  token: string,
  conversationId?: number
) {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  });
  return handleResponse(response); // ✅
}

// GET CONVERSATIONS
export async function getConversations(token: string) {
  const response = await fetch(`${API_URL}/conversations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response); // ✅
}

// GET SINGLE CONVERSATION
export async function getConversation(
  conversationId: number,
  token: string
) {
  const response = await fetch(
    `${API_URL}/conversation/${conversationId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return handleResponse(response); // ✅
}

// CREATE NEW CHAT
export async function createConversation(token: string) {
  const response = await fetch(`${API_URL}/conversation/new`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response); // ✅
}

// DELETE CONVERSATION
export async function deleteConversation(
  conversationId: number,
  token: string
) {
  const response = await fetch(
    `${API_URL}/conversation/${conversationId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return handleResponse(response); // ✅
}

// SAVE PARTIAL (STOPPED) MESSAGE
export async function savePartial(
  conversationId: number,
  content: string,
  token: string
) {
  const response = await fetch(`${API_URL}/save-partial`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      content,
    }),
  });
  return handleResponse(response); // ✅
}
// TRANSCRIBE VOICE
export async function transcribeAudio(
  audioBlob: Blob,
  token: string,
  extension: string = "webm"
) {
  const formData = new FormData();
  // ✅ Use correct filename extension for Safari mp4 vs Chrome webm
  formData.append("file", audioBlob, `audio.${extension}`);

  const response = await fetch(`${API_URL}/transcribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return handleResponse(response);
}