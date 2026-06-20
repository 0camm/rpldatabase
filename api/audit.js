import { getRecentAuditLogs } from './_audit.js';

const ADMIN_PASS = process.env.ADMIN_PASS;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};

  if (!ADMIN_PASS || password !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const logs = await getRecentAuditLogs();

    // newest first
    logs.sort((a, b) => new Date(b.ts) - new Date(a.ts));

    return res.status(200).json({ logs });
  } catch (err) {
    console.error('POST /api/audit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
