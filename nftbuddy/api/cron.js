// api/cron.js
// Called every minute by Vercel Cron (see vercel.json)
// Scans all schedules, sends due push notifications via VAPID web-push

import { kv } from '@vercel/kv';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@mintreminder.app',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export default async function handler(req, res) {
  // Vercel cron calls this as GET; protect other callers with a secret
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = Date.now();
  let sent = 0, failed = 0, cleaned = 0;

  try {
    // Get all schedule keys
    const keys = await kv.keys('schedule:*');
    if (!keys.length) return res.json({ ok: true, sent: 0, msg: 'No schedules' });

    await Promise.all(keys.map(async (schedKey) => {
      const clientId = schedKey.replace('schedule:', '');
      const raw = await kv.get(schedKey);
      if (!raw) return;

      let schedule = JSON.parse(raw);
      let changed = false;
      const now2 = Date.now(); // fresh timestamp inside map

      for (const notif of schedule) {
        if (notif.sent) continue;
        if (notif.fireAt > now2 + 30000) continue; // not due yet (30s buffer)

        // Load push subscription
        const subRaw = await kv.get(`sub:${clientId}`);
        if (!subRaw) {
          // Subscription gone — clean up
          await kv.del(schedKey);
          cleaned++;
          return;
        }

        const subscription = JSON.parse(subRaw);

        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: notif.title || 'Mint Reminder',
              body: notif.body,
              tag: notif.id,
              icon: '/icon-192.png',
              badge: '/icon-72.png',
              data: { url: '/' },
              requireInteraction: notif.urgent || false
            })
          );
          notif.sent = true;
          changed = true;
          sent++;
        } catch (err) {
          // 410 Gone = subscription expired/revoked
          if (err.statusCode === 410 || err.statusCode === 404) {
            await kv.del(`sub:${clientId}`);
            await kv.del(schedKey);
            cleaned++;
            return;
          }
          failed++;
          console.error(`Push failed for ${clientId}:`, err.message);
        }
      }

      if (changed) {
        // Remove sent notifications older than 24h to keep storage lean
        const cutoff = Date.now() - 86400000;
        schedule = schedule.filter(n => !n.sent || n.fireAt > cutoff);
        await kv.set(schedKey, JSON.stringify(schedule), { ex: 60 * 60 * 24 * 365 });
      }
    }));
  } catch (err) {
    console.error('Cron error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }

  res.json({ ok: true, sent, failed, cleaned, ts: new Date().toISOString() });
}
