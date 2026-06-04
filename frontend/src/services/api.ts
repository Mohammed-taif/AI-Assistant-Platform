const API_URL = "http://127.0.0.1:8000";

// LOGIN
export async function login(
  username: string,
  password: string
) {
  const response = await fetch(
    `${API_URL}/login?username=${username}&password=${password}`,
    {
      method: "POST",
    }
  );

  return response.json();
}

// SEND MESSAGE
export async function sendMessage(
  message: string,
  token: string,
  conversationId?: number
) {

  const response = await fetch(
    `${API_URL}/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
      }),
    }
  );

  return response.json();
}

// GET CONVERSATIONS
export async function getConversations(
  token: string
) {

  const response = await fetch(
    `${API_URL}/conversations`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.json();
}

// GET SINGLE CONVERSATION
export async function getConversation(
  conversationId: number,
  token: string
) {

  const response = await fetch(
    `${API_URL}/conversation/${conversationId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.json();
}

// CREATE NEW CHAT
export async function createConversation(
  token: string
) {

  const response = await fetch(
    `${API_URL}/conversation/new`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.json();
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
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.json();
}