// api/vapid-key.js — GET /api/vapid-key
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return res.status(500).json({ error: 'VAPID_PUBLIC_KEY not set in environment variables.' });
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ publicKey });
}
