const API_URL = "http://127.0.0.1:8000";

export async function login(
  username: string,
  password: string
) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  return response.json();
}

export async function sendMessage(
  message: string,
  token: string
) {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
    }),
  });

  return response.json();
}

export async function getHistory(
  userId: string,
  token: string
) {
  const response = await fetch(
    `${API_URL}/history/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.json();
}

export async function clearHistory(
  userId: string,
  token: string
) {
  const response = await fetch(
    `${API_URL}/clear-chat/${userId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.json();
}