import { getClient } from './_redis.js';

const ARCHIVE_KEY = 'archives:seasons';
const MAX_ARCHIVES = 50; // hard cap so the list never grows unbounded

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const kv = await getClient();
    const raw = await kv.lrange(ARCHIVE_KEY, 0, MAX_ARCHIVES - 1);
    if (!raw || !raw.length) return res.status(200).json({ archives: [] });

    const archives = raw
      .map(v => {
        try {
          return typeof v === 'string' ? JSON.parse(v) : v;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      // newest first, lpush already puts newest at index 0, but sort defensively
      .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));

    // list view doesn't need full player payloads, just summary info
    const summaries = archives.map(a => ({
      id: a.id,
      season: a.season,
      archivedAt: a.archivedAt,
      playerCount: Array.isArray(a.players) ? a.players.length : 0,
    }));

    return res.status(200).json({ archives: summaries });
  } catch (err) {
    console.error('GET /api/archives error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
