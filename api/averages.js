import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const [data, updatedAt] = await Promise.all([
      kv.get('cache:averages'),
      kv.get('meta:updatedAt')
    ]);

    if (!data) {
      return res.status(200).json({ players: [], updatedAt: null });
    }

    return res.status(200).json({
      players: data,
      updatedAt: updatedAt || null
    });
  } catch (err) {
    console.error('GET /api/averages error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
