const SUPA_URL  = 'https://savrxykygruzyngttekl.supabase.co';
const ANON_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhdnJ4eWt5Z3J1enluZ3R0ZWtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3MTU4NTEsImV4cCI6MjA2MjI5MTg1MX0.P0Uu2NnSNDVpV1pM5hMHJqASFVjUhp4HJNVqHhI7cyg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  // Verify token
  const userRes = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY }
  });
  const user = await userRes.json();
  if (!userRes.ok || !user.id) return res.status(401).json({ error: 'invalid token' });

  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'subscription required' });

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const saveRes = await fetch(`${SUPA_URL}/rest/v1/push_subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${svcKey}`,
      apikey: svcKey,
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ user_id: user.id, subscription, updated_at: new Date().toISOString() })
  });

  if (!saveRes.ok) {
    const err = await saveRes.text();
    return res.status(500).json({ error: err });
  }
  return res.status(200).json({ ok: true });
}
