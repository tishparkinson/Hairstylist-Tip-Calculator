// netlify/functions/checkout.js
import Stripe from "stripe";

export default async (req) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    // Get email from query param if passed, otherwise let Stripe collect it
    const url = new URL(req.url);
    const emailParam = url.searchParams.get("email");

    // If we have an email, check for existing active subscription
    if (emailParam) {
      const customers = await stripe.customers.list({ email: emailParam, limit: 5 });
      for (const customer of customers.data) {
        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: "active",
          limit: 1,
        });
        if (subs.data.length > 0) {
          // Already subscribed — send to portal to manage
          const portalSession = await stripe.billingPortal.sessions.create({
            customer: customer.id,
            return_url: "https://geotipper.com/premium/",
          });
          return Response.redirect(portalSession.url, 303);
        }
      }
    }

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

  } catch (err) {
    console.error("Checkout error:", err);
    return Response.redirect("https://geotipper.com/pricing", 302);
  }
};
