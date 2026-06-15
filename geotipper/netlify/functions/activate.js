// netlify/functions/activate.js
import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import crypto from "crypto";

function generateLicenseKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let key = "";
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) key += "-";
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

async function sendLicenseEmail(toEmail, licenseKey) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [toEmail],
      subject: "Your GeoTipper Premium License Key",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;background:#0D0D0F;color:#FAFAF8;">
          <div style="margin-bottom:24px;">
            <span style="font-family:Georgia,serif;font-size:20px;font-weight:800;color:#fff;letter-spacing:-.02em;">
              Geo<span style="color:#4ade80">Tipper</span>
            </span>
          </div>

          <h1 style="font-size:22px;font-weight:800;color:#fff;margin:0 0 8px;">You're in. 🎉</h1>
          <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0 0 28px;">
            Thanks for subscribing to GeoTipper Premium. Below is your license key — 
            save it somewhere safe. You can use it to unlock Premium on any device or browser.
          </p>

          <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(74,222,128,0.3);border-radius:10px;padding:20px;text-align:center;margin-bottom:28px;">
            <p style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin:0 0 10px;">Your License Key</p>
            <p style="font-family:Georgia,serif;font-size:26px;font-weight:800;color:#4ade80;letter-spacing:.14em;margin:0;">${licenseKey}</p>
          </div>

          <p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.7;margin:0 0 8px;">
            <strong style="color:rgba(255,255,255,0.8);">Using a new device?</strong><br>
            Go to <a href="https://geotipper.com/redeem/" style="color:#4ade80;">geotipper.com/redeem</a>, 
            enter your key, and Premium unlocks instantly.
          </p>

          <p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.7;margin:0 0 28px;">
            <strong style="color:rgba(255,255,255,0.8);">Manage your subscription:</strong><br>
            <a href="https://billing.stripe.com/p/login/8x25kE7Mq8T7edH8341RC00" style="color:#4ade80;">billing.stripe.com</a>
          </p>

          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:0 0 20px;">
          <p style="font-size:11px;color:rgba(255,255,255,0.25);line-height:1.65;margin:0;">
            Questions? Reply to this email or contact 
            <a href="mailto:verdantwebsolutions@gmail.com" style="color:rgba(255,255,255,0.4);">verdantwebsolutions@gmail.com</a><br>
            © 2025 Verdant Web Solutions, LLC
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
  } else {
    console.log(`License key email sent to ${toEmail}`);
  }
}

async function attachKeyToStripe(stripe, session, licenseKey) {
  const promises = [];

  // Option 1: Save to subscription metadata (visible in Stripe dashboard,
  // persists for the life of the subscription, great for support lookups)
  if (session.subscription) {
    promises.push(
      stripe.subscriptions.update(session.subscription, {
        metadata: { license_key: licenseKey },
      }).then(() => console.log("License key saved to subscription metadata"))
        .catch(err => console.error("Failed to update subscription metadata:", err))
    );
  }

  // Also save to customer metadata so it's visible on the customer record too
  if (session.customer) {
    promises.push(
      stripe.customers.update(session.customer, {
        metadata: { license_key: licenseKey },
      }).then(() => console.log("License key saved to customer metadata"))
        .catch(err => console.error("Failed to update customer metadata:", err))
    );
  }

  // Option 2: Add license key as a custom field on the invoice PDF
  // Customers see this on their Stripe receipt and downloadable invoice
  if (session.invoice) {
    promises.push(
      stripe.invoices.update(session.invoice, {
        custom_fields: [{ name: "License Key", value: licenseKey }],
      }).then(() => console.log("License key added to invoice custom fields"))
        .catch(err => console.error("Failed to update invoice custom fields:", err))
    );
  }

  await Promise.allSettled(promises);
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return Response.redirect("https://geotipper.com/pricing", 302);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Expand invoice so we can add the custom field to it
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["invoice"],
    });

    if (session.payment_status !== "paid") {
      return Response.redirect("https://geotipper.com/pricing", 302);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const licenseKey = generateLicenseKey();
    const email = session.customer_details?.email;
    const store = getStore("geo-access-tokens");

    await store.set(token, JSON.stringify({
      email,
      customerId: session.customer,
      subscriptionId: session.subscription,
      licenseKey,
      created: Date.now(),
    }));

    await store.set(`lk:${licenseKey}`, token);

    console.log(`Token created for ${email}, key: ${licenseKey}`);

    // Attach key to Stripe (metadata + invoice) — non-blocking
    attachKeyToStripe(stripe, session, licenseKey).catch(err =>
      console.error("Stripe key attach failed (non-fatal):", err)
    );

    // Send license key email — non-blocking
    if (email) {
      sendLicenseEmail(email, licenseKey).catch(err =>
        console.error("Email send failed (non-fatal):", err)
      );
    }

    return new Response(null, {
      status: 302,
      headers: {
        "Location": `https://geotipper.com/premium/?welcome=1&key=${encodeURIComponent(licenseKey)}`,
        "Set-Cookie": `geo_token=${token}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`,
      },
    });
  } catch (err) {
    console.error("Activate error:", err);
    return Response.redirect("https://geotipper.com/pricing", 302);
  }
};
