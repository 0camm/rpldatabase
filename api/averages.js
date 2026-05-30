import { getClient } from './_redis.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const kv = await getClient();

    // 2 commands total: hgetall + get — regardless of player count
    const [raw, updatedAt] = await Promise.all([
      kv.hgetall('players'),
      kv.get('meta:updatedAt'),
    ]);

    if (!raw) return res.status(200).json({ players: [], updatedAt: null });

    const players = Object.values(raw).map(v =>
      typeof v === 'string' ? JSON.parse(v) : v
    );

    return res.status(200).json({ players, updatedAt: updatedAt || null });
  } catch (err) {
    console.error('GET /api/averages error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
