// api/unsubscribe.js — POST /api/unsubscribe
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

  const key = 'sub:' + Buffer.from(endpoint).toString('base64').slice(0, 64);
  try {
    await kv.del(key);
    await kv.srem('subscriptions', key);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
}
