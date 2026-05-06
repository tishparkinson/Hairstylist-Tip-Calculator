// netlify/functions/checkout.js
import Stripe from "stripe";

export default async (req) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{
      price: process.env.STRIPE_PRICE_ID,
      quantity: 1,
    }],
    success_url: "https://geotipper.com/activate?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://geotipper.com/pricing",
  });

  return Response.redirect(session.url, 303);
};
