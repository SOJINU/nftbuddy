// api/stats.js — GET /api/stats?adminToken=xxx
// Returns subscriber count for the admin panel

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { adminToken } = req.query;
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const count = await kv.scard('subscriptions');
    res.status(200).json({ subscribers: count || 0 });
  } catch (e) {
    res.status(500).json({ error: 'KV read failed' });
  }
}
