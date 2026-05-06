// netlify/functions/checkout.js
// Creates a Stripe Checkout Session and redirects user to it
// Called when user clicks "Unlock" on /pricing/

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
    customer_email: null, // Stripe will ask for email on the checkout page
  });

  return Response.redirect(session.url, 303);
};
