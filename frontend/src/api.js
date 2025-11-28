const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("yt_token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}
