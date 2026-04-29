// api/subscribe.js — POST /api/subscribe
// Saves a push subscription to Vercel KV
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription object' });

  // Use endpoint URL as key (hashed for brevity)
  const key = 'sub:' + Buffer.from(subscription.endpoint).toString('base64').slice(0, 64);

  try {
    await kv.set(key, JSON.stringify(subscription), { ex: 60 * 60 * 24 * 365 }); // 1 year TTL
    // Track all subscription keys in a set so we can iterate them
    await kv.sadd('subscriptions', key);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('KV error:', e);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
}
