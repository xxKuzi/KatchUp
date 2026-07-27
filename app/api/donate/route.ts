import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const donationPriceId = process.env.STRIPE_DONATION_PRICE_ID;

  if (!secretKey || !donationPriceId) {
    console.error(
      "Stripe donations require STRIPE_SECRET_KEY and STRIPE_DONATION_PRICE_ID.",
    );
    return NextResponse.json(
      { error: "Donations are temporarily unavailable." },
      { status: 503 },
    );
  }

  try {
    const stripe = new Stripe(secretKey);
    const origin = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      line_items: [{ price: donationPriceId, quantity: 1 }],
      success_url: `${origin}/donation/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: origin,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL.");
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Unable to create Stripe donation session:", error);
    return NextResponse.json(
      { error: "Unable to open the donation page. Please try again." },
      { status: 500 },
    );
  }
}
