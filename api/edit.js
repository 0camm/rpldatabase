import { getClient } from './_redis.js';

const ADMIN_PASS = process.env.ADMIN_PASS;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, username, stats } = req.body || {};

  if (!ADMIN_PASS || password !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  if (!username || typeof username !== 'string') return res.status(400).json({ error: 'Missing username' });
  if (!stats || typeof stats !== 'object') return res.status(400).json({ error: 'Missing stats' });

  const safeUsername = String(username).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 64);
  if (!safeUsername) return res.status(400).json({ error: 'Invalid username' });

  try {
    const kv = await getClient();
    const key = `player:${safeUsername}`;
    const existing = await kv.get(key);

    if (!existing) return res.status(404).json({ error: `Player "${safeUsername}" not found` });

    const record = {
      username: safeUsername,
      stats: {
        GP:    Number(stats.GP)    || 0,
        PPG:   Number(stats.PPG)   || 0,
        APG:   Number(stats.APG)   || 0,
        RPG:   Number(stats.RPG)   || 0,
        SPG:   Number(stats.SPG)   || 0,
        BPG:   Number(stats.BPG)   || 0,
        TOPG:  Number(stats.TOPG)  || 0,
        FTPG:  Number(stats.FTPG)  || 0,
        FG:    Number(stats.FG)    || 0,
        FT:    Number(stats.FT)    || 0,
        '3PT': Number(stats['3PT']) || 0,
        '2PT': Number(stats['2PT']) || 0,
      },
      updatedAt: new Date().toISOString()
    };

    // Store as native object — Upstash serializes it; avoids double-JSON-string issue
    await kv.set(key, record);
    await kv.set('meta:updatedAt', new Date().toISOString());

    // Return only the public-facing shape (no internal updatedAt per player)
    return res.status(200).json({
      success: true,
      player: { username: record.username, stats: record.stats }
    });
  } catch (err) {
    console.error('POST /api/edit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
