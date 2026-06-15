// netlify/functions/webhook.js
import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response("Webhook signature failed", { status: 400 });
  }

  const store = getStore("geo-access-tokens");

  if (event.type === "customer.subscription.deleted") {
    const customerId = event.data.object.customer;
    try {
      const { blobs } = await store.list();
      for (const blob of blobs) {
        // Skip license key reverse-lookup entries
        if (blob.key.startsWith("lk:")) continue;

        const raw = await store.get(blob.key);
        const record = JSON.parse(raw);
        if (record.customerId === customerId) {
          // Delete the license key reverse-lookup too
          if (record.licenseKey) {
            await store.delete(`lk:${record.licenseKey}`);
          }
          await store.delete(blob.key);
          console.log(`Removed access token + license key for customer ${customerId}`);
        }
      }
    } catch (err) {
      console.error("Error removing token:", err);
    }
  }

  return new Response("OK", { status: 200 });
};
