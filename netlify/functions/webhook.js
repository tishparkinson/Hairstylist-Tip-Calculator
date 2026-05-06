// netlify/functions/webhook.js
// Receives Stripe webhook events
// On subscription cancellation: removes the access token from the store

import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response("Webhook signature failed", { status: 400 });
  }

  const store = getStore("geo-access-tokens");

  if (event.type === "customer.subscription.deleted") {
    // Find and remove the token for this customer
    const customerId = event.data.object.customer;
    try {
      const { blobs } = await store.list();
      for (const blob of blobs) {
        const record = JSON.parse(await store.get(blob.key));
        if (record.customerId === customerId) {
          await store.delete(blob.key);
          console.log(`Removed access token for customer ${customerId}`);
        }
      }
    } catch (err) {
      console.error("Error removing token:", err);
    }
  }

  return new Response("OK", { status: 200 });
};
