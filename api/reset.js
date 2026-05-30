import { getClient } from './_redis.js';

const ADMIN_PASS = process.env.ADMIN_PASS;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};

  if (!ADMIN_PASS || password !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const kv = await getClient();

    // 2 commands total to wipe everything, regardless of player count
    await Promise.all([
      kv.del('players'),
      kv.del('meta:updatedAt'),
    ]);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('POST /api/reset error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
