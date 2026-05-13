import Stripe from 'stripe';

const SUPA_URL = 'https://savrxykygruzyngttekl.supabase.co';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = webhookSecret
      ? stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
      : JSON.parse(rawBody.toString());
  } catch (e) {
    return res.status(400).json({ error: 'Webhook signature failed: ' + e.message });
  }

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hdrs = { Authorization: `Bearer ${svcKey}`, apikey: svcKey, 'Content-Type': 'application/json' };

  async function upsertSub(data) {
    await fetch(`${SUPA_URL}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: { ...hdrs, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ ...data, updated_at: new Date().toISOString() })
    });
  }

  async function getUidFromCustomer(customerId) {
    const r = await fetch(`${SUPA_URL}/rest/v1/subscriptions?stripe_customer_id=eq.${customerId}&select=user_id`, { headers: hdrs });
    const rows = await r.json();
    return rows?.[0]?.user_id || null;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const uid = session.metadata?.supabase_uid;
      if (!uid) break;
      await upsertSub({
        user_id: uid,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        plan: 'pro',
        status: 'active',
      });
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const uid = sub.metadata?.supabase_uid || await getUidFromCustomer(sub.customer);
      if (!uid) break;
      const isActive = ['active', 'trialing'].includes(sub.status);
      await upsertSub({
        user_id: uid,
        stripe_customer_id: sub.customer,
        stripe_subscription_id: sub.id,
        plan: isActive ? 'pro' : 'free',
        status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      });
      break;
    }
  }

  return res.status(200).json({ received: true });
}
