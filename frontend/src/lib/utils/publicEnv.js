import { API_BASE_URL } from "@/lib/api/config";

let publicEnvLoaded = false;

export function getPublicEnvValue(key, fallback = "") {
  if (typeof window === "undefined") return fallback;
  const env = window.__PUBLIC_ENV__ || {};
  const value = env[key];
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  return fallback;
}

export async function loadPublicEnvVariables() {
  if (typeof window === "undefined") return {};
  if (publicEnvLoaded && window.__PUBLIC_ENV__) return window.__PUBLIC_ENV__;

  try {
    const endpoint = `${API_BASE_URL.replace(/\/$/, "").replace(/\/api$/, "")}/api/env/public`;
    const response = await fetch(endpoint, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const json = await response.json();
    const envData = json?.data || {};
    window.__PUBLIC_ENV__ = envData;
    publicEnvLoaded = true;
    
    return envData;
  } catch (error) {
    console.warn("[PublicEnv] Failed to load runtime env from backend.", error?.message || error);
    window.__PUBLIC_ENV__ = window.__PUBLIC_ENV__ || {};
    return window.__PUBLIC_ENV__;
  }
}
