import { getClient } from './_redis.js';
import { logAudit } from './_audit.js';

const ADMIN_PASS = process.env.ADMIN_PASS;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};

  if (!ADMIN_PASS || password !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const kv = await getClient();

    // capture a snapshot before wiping, for the audit trail
    const before = await kv.hgetall('players');
    const players = before ? Object.keys(before) : [];

    // 2 commands total to wipe everything, regardless of player count
    await Promise.all([
      kv.del('players'),
      kv.del('meta:updatedAt'),
    ]);

    await logAudit({
      action: 'RESET_ALL',
      status: 'success',
      target: `${players.length} player${players.length !== 1 ? 's' : ''}`,
      prevValue: { playerCount: players.length, players },
    });

    return res.status(200).json({ success: true, deleted: players.length });
  } catch (err) {
    console.error('POST /api/reset error:', err);
    await logAudit({
      action: 'RESET_ALL',
      status: 'failure',
      error: 'Internal server error',
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
