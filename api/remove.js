import { getClient } from './_redis.js';
import { logAudit } from './_audit.js';

const ADMIN_PASS = process.env.ADMIN_PASS;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, username } = req.body || {};

  if (!ADMIN_PASS || password !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  if (!username || typeof username !== 'string') return res.status(400).json({ error: 'Missing username' });

  const safeUsername = String(username).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 64);
  if (!safeUsername) return res.status(400).json({ error: 'Invalid username' });

  try {
    const kv = await getClient();

    // 1 command to check existence
    const existing = await kv.hget('players', safeUsername);
    if (!existing) {
      // The frontend probes this endpoint with a sentinel username purely
      // to validate the admin password on login — don't pollute the log.
      if (safeUsername !== '__auth_check__') {
        await logAudit({
          action: 'REMOVE_PLAYER',
          status: 'failure',
          target: safeUsername,
          error: `Player "${safeUsername}" not found`,
        });
      }
      return res.status(404).json({ error: `Player "${safeUsername}" not found` });
    }

    const prevRecord = typeof existing === 'string' ? JSON.parse(existing) : existing;

    // 2 commands: hdel + meta
    await Promise.all([
      kv.hdel('players', safeUsername),
      kv.set('meta:updatedAt', new Date().toISOString()),
    ]);

    await logAudit({
      action: 'REMOVE_PLAYER',
      status: 'success',
      target: safeUsername,
      prevValue: prevRecord.stats || null,
    });

    return res.status(200).json({ success: true, deleted: safeUsername });
  } catch (err) {
    console.error('POST /api/remove error:', err);
    await logAudit({
      action: 'REMOVE_PLAYER',
      status: 'failure',
      target: safeUsername,
      error: 'Internal server error',
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
