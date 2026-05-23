import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all player keys
    const keys = await kv.keys('player:*');
    
    if (!keys || keys.length === 0) {
      return res.status(200).json({ players: [], updatedAt: null });
    }

    // Fetch all player records in parallel
    const players = await Promise.all(
      keys.map(async (key) => {
        const data = await kv.get(key);
        return data;
      })
    );

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
