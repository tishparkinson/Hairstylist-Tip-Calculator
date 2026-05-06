// netlify/functions/activate.js
// Stripe redirects here after successful payment
// Validates the session, creates a secure token, sets cookie

import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import crypto from "crypto";

export default async (req) => {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    return Response.redirect("https://geotipper.com/pricing", 302);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    return Response.redirect("https://geotipper.com/pricing", 302);
  }

  if (session.payment_status !== "paid") {
    return Response.redirect("https://geotipper.com/pricing", 302);
  }

  // Generate a secure random token
  const token = crypto.randomBytes(32).toString("hex");

  // Store it server-side in Netlify Blobs
  const store = getStore("geo-access-tokens");
  await store.set(token, JSON.stringify({
    email: session.customer_details?.email,
    customerId: session.customer,
    subscriptionId: session.subscription,
    created: Date.now(),
  }), { expiresAt: new Date(Date.now() + 366 * 24 * 60 * 60 * 1000) });

  // Set the cookie and redirect to the premium section
  return new Response(null, {
    status: 302,
    headers: {
      "Location": "https://geotipper.com/premium/",
      "Set-Cookie": `geo_token=${token}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`,
    },
  });
};
