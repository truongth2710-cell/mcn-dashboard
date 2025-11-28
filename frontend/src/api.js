const API_BASE =
  import.meta.env.VITE_API_BASE || "https://api2.thesun.media/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("yt_token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(API_BASE + path, {
    ...options,
    headers
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
      if (data && data.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  try {
    return await res.json();
  } catch {
    return null;
  }
}