// api/google-client-id.js — returns public Google OAuth client ID
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ clientId: process.env.GOOGLE_CLIENT_ID || null });
}
