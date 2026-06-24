import { getClient } from './_redis.js';

const ARCHIVE_KEY = 'archives:seasons';
const MAX_ARCHIVES = 50;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const kv = await getClient();
    const raw = await kv.lrange(ARCHIVE_KEY, 0, MAX_ARCHIVES - 1);
    if (!raw || !raw.length) return res.status(404).json({ error: 'Archive not found' });

    const archives = raw
      .map(v => {
        try {
          return typeof v === 'string' ? JSON.parse(v) : v;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const match = archives.find(a => a.id === id);
    if (!match) return res.status(404).json({ error: 'Archive not found' });

    return res.status(200).json({ archive: match });
  } catch (err) {
    console.error('GET /api/archive error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
