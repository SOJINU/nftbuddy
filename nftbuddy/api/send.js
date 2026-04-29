// api/send.js — POST /api/send
// Sends a push notification to ALL subscribed users.
// Protected by ADMIN_TOKEN env var.
// Body: { title, body, url, adminToken }

import { kv } from '@vercel/kv';
import webpush from 'web-push';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth check ──────────────────────────────
  const { title, body, url = '/', adminToken } = req.body || {};

  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }

  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required' });
  }

  // ── Configure webpush ───────────────────────
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@mintreminder.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  // ── Fetch all subscriptions ─────────────────
  let subKeys = [];
  try {
    subKeys = await kv.smembers('subscriptions');
  } catch (e) {
    return res.status(500).json({ error: 'Failed to read subscriptions from KV' });
  }

  if (!subKeys || subKeys.length === 0) {
    return res.status(200).json({ sent: 0, message: 'No subscribers yet' });
  }

  // ── Send to each subscriber ─────────────────
  const payload = JSON.stringify({ title, body, url, icon: '/icon-192.png' });
  let sent = 0, failed = 0, removed = 0;
  const staleKeys = [];

  await Promise.allSettled(
    subKeys.map(async (key) => {
      const raw = await kv.get(key);
      if (!raw) { staleKeys.push(key); return; }

      const sub = typeof raw === 'string' ? JSON.parse(raw) : raw;

      try {
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription is gone — clean it up
          staleKeys.push(key);
          removed++;
        } else {
          console.warn('Push failed for', key, err.message);
          failed++;
        }
      }
    })
  );

  // Clean stale subscriptions
  if (staleKeys.length > 0) {
    await Promise.all([
      ...staleKeys.map(k => kv.del(k)),
      kv.srem('subscriptions', ...staleKeys)
    ]);
  }

  res.status(200).json({ sent, failed, removed, total: subKeys.length });
}
