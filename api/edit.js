import { getClient } from './_redis.js';
import { logAudit } from './_audit.js';

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

    // 1 command to check existence
    const existing = await kv.hget('players', safeUsername);
    if (!existing) {
      await logAudit({
        action: 'EDIT_PLAYER',
        status: 'failure',
        target: safeUsername,
        error: `Player "${safeUsername}" not found`,
      });
      return res.status(404).json({ error: `Player "${safeUsername}" not found` });
    }

    const prevRecord = typeof existing === 'string' ? JSON.parse(existing) : existing;

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

    // 2 commands: hset + meta
    await Promise.all([
      kv.hset('players', { [safeUsername]: JSON.stringify(record) }),
      kv.set('meta:updatedAt', new Date().toISOString()),
    ]);

    await logAudit({
      action: 'EDIT_PLAYER',
      status: 'success',
      target: safeUsername,
      prevValue: prevRecord.stats || null,
      newValue: record.stats,
    });

    return res.status(200).json({ success: true, player: record });
  } catch (err) {
    console.error('POST /api/edit error:', err);
    await logAudit({
      action: 'EDIT_PLAYER',
      status: 'failure',
      target: safeUsername,
      error: 'Internal server error',
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
