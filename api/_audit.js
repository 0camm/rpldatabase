import { getClient } from './_redis.js';

const AUDIT_KEY = 'audit:logs';
const MAX_LOGS = 200;          // hard cap so the list never grows unbounded

/**
 * Append one audit entry to the shared log list.
 * Never throws — a logging failure should never break the underlying
 * admin action, so errors are swallowed (and reported to console).
 *
 * @param {object} entry
 * @param {'EDIT_PLAYER'|'REMOVE_PLAYER'|'RESET_ALL'} entry.action
 * @param {'success'|'failure'} entry.status
 * @param {string} [entry.target]      - username or summary shown in the UI
 * @param {object} [entry.prevValue]   - state before the action
 * @param {object} [entry.newValue]    - state after the action
 * @param {string} [entry.error]       - error message, only for failures
 */
export async function logAudit(entry) {
  try {
    const kv = await getClient();

    const record = {
      action: entry.action,
      status: entry.status || 'success',
      target: entry.target || '',
      prevValue: entry.prevValue ?? null,
      newValue: entry.newValue ?? null,
      error: entry.error || null,
      ts: new Date().toISOString(),
    };

    // lpush + trim in one round trip so the list stays bounded
    await kv.lpush(AUDIT_KEY, JSON.stringify(record));
    await kv.ltrim(AUDIT_KEY, 0, MAX_LOGS - 1);
  } catch (err) {
    // Logging must never take down the calling endpoint.
    console.error('Audit log write failed:', err);
  }
}

/**
 * Fetch all stored logs (newest first), capped at MAX_LOGS.
 */
export async function getRecentAuditLogs() {
  const kv = await getClient();
  const raw = await kv.lrange(AUDIT_KEY, 0, MAX_LOGS - 1);
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
