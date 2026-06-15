// netlify/functions/redeem.js
// Accepts a license key (POST body or GET param), looks up the token,
// sets the auth cookie, and redirects to /premium/
import { getStore } from "@netlify/blobs";

export default async (req) => {
  let licenseKey = "";

  if (req.method === "POST") {
    try {
      const body = await req.text();
      const params = new URLSearchParams(body);
      licenseKey = (params.get("key") || "").trim().toUpperCase().replace(/\s/g, "");
    } catch {}
  } else {
    const url = new URL(req.url);
    licenseKey = (url.searchParams.get("key") || "").trim().toUpperCase().replace(/\s/g, "");
  }

  if (!licenseKey) {
    return Response.redirect("https://geotipper.com/redeem/?error=empty", 302);
  }

  try {
    const store = getStore("geo-access-tokens");
    const token = await store.get(`lk:${licenseKey}`);

    if (!token) {
      return Response.redirect(`https://geotipper.com/redeem/?error=invalid`, 302);
    }

    // Verify the token record still exists (subscription not cancelled)
    const record = await store.get(token);
    if (!record) {
      return Response.redirect(`https://geotipper.com/redeem/?error=expired`, 302);
    }

    // Valid — set cookie and send to premium
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "https://geotipper.com/premium/",
        "Set-Cookie": `geo_token=${token}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`,
      },
    });
  } catch (err) {
    console.error("Redeem error:", err);
    return Response.redirect("https://geotipper.com/redeem/?error=server", 302);
  }
};

export const config = { path: "/.netlify/functions/redeem" };
