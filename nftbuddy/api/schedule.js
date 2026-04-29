// api/schedule.js
// POST { clientId, reminderId, notifications: [{id, fireAt, title, body}] }
// DELETE { clientId, reminderId }

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    const { clientId, reminderId, notifications } = req.body || {};
    if (!clientId || !reminderId || !Array.isArray(notifications)) {
      return res.status(400).json({ error: 'clientId, reminderId, and notifications required' });
    }

    // Verify client subscription exists
    const sub = await kv.get(`sub:${clientId}`);
    if (!sub) return res.status(404).json({ error: 'Subscription not found. Re-enable notifications.' });

    // Load existing schedule for this client
    const existing = await kv.get(`schedule:${clientId}`);
    let schedule = existing ? JSON.parse(existing) : [];

    // Remove old entries for this reminder
    schedule = schedule.filter(n => n.reminderId !== reminderId);

    // Add new ones (only future ones)
    const now = Date.now();
    const fresh = notifications
      .filter(n => n.fireAt > now)
      .map(n => ({ ...n, reminderId, sent: false }));
    schedule.push(...fresh);

    // Set TTL to 1 year
    await kv.set(`schedule:${clientId}`, JSON.stringify(schedule), { ex: 60 * 60 * 24 * 365 });
    return res.json({ scheduled: fresh.length });
  }

  if (req.method === 'DELETE') {
    const { clientId, reminderId } = req.body || {};
    if (!clientId || !reminderId) return res.status(400).json({ error: 'clientId and reminderId required' });

    const existing = await kv.get(`schedule:${clientId}`);
    if (!existing) return res.status(204).end();

    let schedule = JSON.parse(existing);
    schedule = schedule.filter(n => n.reminderId !== reminderId);
    await kv.set(`schedule:${clientId}`, JSON.stringify(schedule), { ex: 60 * 60 * 24 * 365 });
    return res.status(204).end();
  }

  res.status(405).end();
}
