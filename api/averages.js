import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const keys = await kv.keys('player:*');
    
    if (!keys || keys.length === 0) {
      return res.status(200).json({ players: [], updatedAt: null });
    }

    const players = await kv.mget(...keys);

    const updatedAt = await kv.get('meta:updatedAt');

    return res.status(200).json({
      players: players.filter(Boolean),
      updatedAt: updatedAt || null
    });
  } catch (err) {
    console.error('GET /api/averages error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
