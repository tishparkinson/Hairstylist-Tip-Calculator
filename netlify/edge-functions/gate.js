// netlify/functions/gate.js
// Edge Function — runs on Netlify's servers before any /premium/* page is served
// Checks for a valid access token in the cookie
// Redirects to /pricing if not found or invalid

import { getStore } from "@netlify/blobs";

export default async (request, context) => {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.match(/geo_token=([^;]+)/)?.[1];

  if (!token) {
    return Response.redirect("https://geotipper.com/pricing", 302);
  }

  try {
    const store = getStore("geo-access-tokens");
    const record = await store.get(token);

    if (!record) {
      return Response.redirect("https://geotipper.com/pricing", 302);
    }

    // Token is valid — serve the page
    return context.next();
  } catch (err) {
    // If Blobs is unavailable, fail open (serve the page) to avoid locking out paying customers
    console.error("Gate error:", err);
    return context.next();
  }
};

export const config = { path: "/premium/*" };
