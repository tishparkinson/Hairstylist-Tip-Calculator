// netlify/functions/activate.js
import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import crypto from "crypto";

export default async (req) => {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    console.log("Activate called, session_id:", sessionId);

    if (!sessionId) {
      console.log("No session_id found, redirecting to pricing");
      return Response.redirect("https://geotipper.com/pricing", 302);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log("Session status:", session.payment_status);

    if (session.payment_status !== "paid") {
      return Response.redirect("https://geotipper.com/pricing", 302);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const store = getStore("geo-access-tokens");
    await store.set(token, JSON.stringify({
      email: session.customer_details?.email,
      customerId: session.customer,
      subscriptionId: session.subscription,
      created: Date.now(),
    }));

    console.log("Token created, redirecting to premium");

    return new Response(null, {
      status: 302,
      headers: {
        "Location": "https://geotipper.com/premium/",
        "Set-Cookie": `geo_token=${token}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`,
      },
    });
  } catch (err) {
    console.error("Activate error:", err);
    return Response.redirect("https://geotipper.com/pricing", 302);
  }
};
