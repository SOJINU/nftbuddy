// Run once: node scripts/gen-vapid.js
import webpush from 'web-push';
const keys = webpush.generateVAPIDKeys();
console.log('\n✅  VAPID keys generated. Add these to Vercel:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:you@yourdomain.com`);
console.log(`ADMIN_TOKEN=${Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)}`);
console.log('\nGo to: vercel.com → your project → Settings → Environment Variables\n');
