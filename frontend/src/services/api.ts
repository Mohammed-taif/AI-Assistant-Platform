const API_URL = "http://172.24.0.80:8000";

// LOGIN
export async function login(
  username: string,
  password: string
) {

  const response = await fetch(
    `${API_URL}/login`,
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
// SAVE PARTIAL (STOPPED) MESSAGE
export async function savePartial(
  conversationId: number,
  content: string,
  token: string
) {
  const response = await fetch(
    `${API_URL}/save-partial`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        content,
      }),
    }
  );
  return response.json();
}