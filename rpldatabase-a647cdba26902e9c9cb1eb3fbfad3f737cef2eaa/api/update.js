import { getClient } from './_redis.js';

const ROBLOX_SECRET = process.env.ROBLOX_SECRET;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers['authorization'];
  if (!ROBLOX_SECRET || auth !== `Bearer ${ROBLOX_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const body = req.body;
    if (!body || !body.username || !body.stats) {
      return res.status(400).json({ error: 'Missing username or stats' });
    }

    const { username, stats } = body;
    const safeUsername = String(username).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 64);
    if (!safeUsername) return res.status(400).json({ error: 'Invalid username' });

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
      // updatedAt stored internally but never surfaced via /api/averages
      updatedAt: new Date().toISOString()
    };

    const kv = await getClient();
    // Store as native object — Upstash serializes it; avoids double-JSON-string issue
    await kv.set(`player:${safeUsername}`, record);
    await kv.set('meta:updatedAt', new Date().toISOString());

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('POST /api/update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
