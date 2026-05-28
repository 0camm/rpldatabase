import { getClient } from './_redis.js';

const ALLOWED_STATS = ['GP','PPG','APG','RPG','SPG','BPG','TOPG','FTPG','FG','FT','3PT','2PT'];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const kv = await getClient();
    const keys = await kv.keys('player:*');

    if (!keys || keys.length === 0) {
      return res.status(200).json({ players: [], updatedAt: null });
    }

    const raw = await Promise.all(keys.map(key => kv.get(key)));

    const players = raw
      .map(item => {
        try {
          // Upstash may return a parsed object or a JSON string depending on how it was stored
          const record = typeof item === 'string' ? JSON.parse(item) : item;
          if (!record || !record.username || !record.stats) return null;

          // Only expose the fields the frontend needs — no internal timestamps per player
          const safeStats = {};
          for (const key of ALLOWED_STATS) {
            safeStats[key] = typeof record.stats[key] === 'number' ? record.stats[key] : 0;
          }

          return { username: record.username, stats: safeStats };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const updatedAt = await kv.get('meta:updatedAt');

    return res.status(200).json({ players, updatedAt: updatedAt || null });
  } catch (err) {
    console.error('GET /api/averages error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
