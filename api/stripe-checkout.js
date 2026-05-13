import Stripe from 'stripe';

const SUPA_URL = 'https://savrxykygruzyngttekl.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  // Decode user from JWT
  let userId, userEmail;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    userId = payload.sub;
    userEmail = payload.email;
    if (!userId) throw new Error('no sub');
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) return res.status(500).json({ error: 'STRIPE_PRICE_ID not configured' });

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hdrs = { Authorization: `Bearer ${svcKey}`, apikey: svcKey, 'Content-Type': 'application/json' };

  // Check if user already has a Stripe customer ID
  const subRes = await fetch(`${SUPA_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=stripe_customer_id`, { headers: hdrs });
  const subs = await subRes.json();
  let customerId = subs?.[0]?.stripe_customer_id;

  // Create Stripe customer if needed
  if (!customerId) {
    const customer = await stripe.customers.create({ email: userEmail, metadata: { supabase_uid: userId } });
    customerId = customer.id;
  }

  const origin = req.headers.origin || 'https://bauplan-weld.vercel.app';

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${origin}/?upgrade=success`,
    cancel_url: `${origin}/?upgrade=cancel`,
    metadata: { supabase_uid: userId },
    subscription_data: { metadata: { supabase_uid: userId } },
    allow_promotion_codes: true,  // enables promo/discount codes
    locale: 'de',
  });

  return res.status(200).json({ url: session.url });
}
