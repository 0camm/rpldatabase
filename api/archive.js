import { getClient } from './_redis.js';
import { logAudit } from './_audit.js';

const ADMIN_PASS = process.env.ADMIN_PASS;
const ARCHIVE_KEY = 'archives:seasons';
const MAX_ARCHIVES = 50;

async function loadArchives(kv) {
  const raw = await kv.lrange(ARCHIVE_KEY, 0, MAX_ARCHIVES - 1);
  if (!raw || !raw.length) return [];
  return raw
    .map(v => {
      try {
        return typeof v === 'string' ? JSON.parse(v) : v;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const kv = await getClient();

  if (req.method === 'GET') {
    try {
      const archives = await loadArchives(kv);
      const match = archives.find(a => a.id === id);
      if (!match) return res.status(404).json({ error: 'Archive not found' });
      return res.status(200).json({ archive: match });
    } catch (err) {
      console.error('GET /api/archive error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    const { password } = req.body || {};
    if (!ADMIN_PASS || password !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const archives = await loadArchives(kv);
      const match = archives.find(a => a.id === id);
      if (!match) return res.status(404).json({ error: 'Archive not found' });

      // snapshot whatever is currently live so restoring never destroys data —
      // but skip it if live data is identical to the archive being restored
      // (e.g. restoring right after the same data was just archived/reset)
      const currentRaw = await kv.hgetall('players');
      const currentPlayers = currentRaw
        ? Object.values(currentRaw).map(v => (typeof v === 'string' ? JSON.parse(v) : v))
        : [];

      const fingerprint = (list) => JSON.stringify(
        list.map(p => ({ username: p.username, stats: p.stats })).sort((a, b) => a.username.localeCompare(b.username))
      );
      const isDuplicate = currentPlayers.length > 0
        && currentPlayers.length === match.players.length
        && fingerprint(currentPlayers) === fingerprint(match.players);

      if (currentPlayers.length && !isDuplicate) {
        const preRestoreSnapshot = {
          id: `${Date.now()}`,
          season: null,
          archivedAt: new Date().toISOString(),
          lastUpdatedAt: (await kv.get('meta:updatedAt')) || null,
          players: currentPlayers,
          note: 'Auto-archived before restore',
        };
        await kv.lpush(ARCHIVE_KEY, JSON.stringify(preRestoreSnapshot));
        await kv.ltrim(ARCHIVE_KEY, 0, MAX_ARCHIVES - 1);
      }

      const restoredHash = {};
      for (const p of match.players) {
        if (p && p.username) restoredHash[p.username] = JSON.stringify(p);
      }

      await kv.del('players');
      if (Object.keys(restoredHash).length) {
        await kv.hset('players', restoredHash);
      }
      await kv.set('meta:updatedAt', new Date().toISOString());

      // remove the restored entry from the archive list so it doesn't
      // sit there alongside the now-live data — rebuild the list without it
      const remaining = (await loadArchives(kv)).filter(a => a.id !== id);
      await kv.del(ARCHIVE_KEY);
      if (remaining.length) {
        // lrange returned newest-first; rpush in reverse to preserve that order
        await kv.rpush(ARCHIVE_KEY, ...remaining.slice().reverse().map(a => JSON.stringify(a)));
      }

      await logAudit({
        action: 'RESTORE_ARCHIVE',
        status: 'success',
        target: match.season || `Archive from ${match.archivedAt}`,
        newValue: { playerCount: match.players.length },
      });

      return res.status(200).json({ success: true, restored: match.players.length });
    } catch (err) {
      console.error('POST /api/archive error:', err);
      await logAudit({
        action: 'RESTORE_ARCHIVE',
        status: 'failure',
        error: 'Internal server error',
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    const { password } = req.body || {};
    if (!ADMIN_PASS || password !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const archives = await loadArchives(kv);
      const match = archives.find(a => a.id === id);
      if (!match) return res.status(404).json({ error: 'Archive not found' });

      const remaining = archives.filter(a => a.id !== id);
      await kv.del(ARCHIVE_KEY);
      if (remaining.length) {
        await kv.rpush(ARCHIVE_KEY, ...remaining.slice().reverse().map(a => JSON.stringify(a)));
      }

      await logAudit({
        action: 'DELETE_ARCHIVE',
        status: 'success',
        target: match.season || `Archive from ${match.archivedAt}`,
        prevValue: { playerCount: match.players.length },
      });

      return res.status(200).json({ success: true, deleted: true });
    } catch (err) {
      console.error('DELETE /api/archive error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
