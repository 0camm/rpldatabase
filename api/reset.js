import { getClient } from './_redis.js';
import { logAudit } from './_audit.js';

const ADMIN_PASS = process.env.ADMIN_PASS;
const ARCHIVE_KEY = 'archives:seasons';
const MAX_ARCHIVES = 50; // hard cap so the archive list never grows unbounded

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, season, skipArchive } = req.body || {};

  if (!ADMIN_PASS || password !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const kv = await getClient();

    // capture a full snapshot before wiping
    const before = await kv.hgetall('players');
    const updatedAt = await kv.get('meta:updatedAt');
    const players = before
      ? Object.values(before).map(v => (typeof v === 'string' ? JSON.parse(v) : v))
      : [];
    const usernames = players.map(p => p.username);

    if (players.length && !skipArchive) {
      const snapshot = {
        id: `${Date.now()}`,
        season: (typeof season === 'string' && season.trim()) ? season.trim().slice(0, 64) : null,
        archivedAt: new Date().toISOString(),
        lastUpdatedAt: updatedAt || null,
        players,
      };
      // lpush + trim in one round trip so the archive list stays bounded
      await kv.lpush(ARCHIVE_KEY, JSON.stringify(snapshot));
      await kv.ltrim(ARCHIVE_KEY, 0, MAX_ARCHIVES - 1);
    }

    // 2 commands total to wipe everything, regardless of player count
    await Promise.all([
      kv.del('players'),
      kv.del('meta:updatedAt'),
    ]);

    await logAudit({
      action: 'RESET_ALL',
      status: 'success',
      target: `${players.length} player${players.length !== 1 ? 's' : ''}`,
      prevValue: { playerCount: players.length, players: usernames },
    });

    return res.status(200).json({ success: true, deleted: players.length, archived: players.length > 0 && !skipArchive });
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
