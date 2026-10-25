const defaultApiUrl = "http://localhost:8000/api/v1";

export const publicEnv = Object.freeze({
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? defaultApiUrl,
});
