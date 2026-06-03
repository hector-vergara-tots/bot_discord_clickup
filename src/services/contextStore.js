/**
 * contextStore — per-user conversation context with JSON file persistence
 *
 * Stores the last MAX_ENTRIES bug reports per user (keyed by Discord userId).
 * Entries older than TTL_MS are ignored on read and pruned on save.
 * Persists to disk so context survives bot restarts.
 *
 * Usage:
 *   const contextStore = require('./contextStore');
 *   contextStore.save(userId, { tipo, ambiente, descripcion, report });
 *   const prev = contextStore.getRecent(userId); // null if none / expired
 */

const fs     = require('fs');
const path   = require('path');
const logger = require('../utils/logger');

const STORE_PATH  = path.join(__dirname, '../../data/context-store.json');
const TTL_MS      = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ENTRIES = 3;                    // keep last 3 reports per user

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpired(entry) {
  return Date.now() - entry.timestamp > TTL_MS;
}

// ── ContextStore ──────────────────────────────────────────────────────────────

class ContextStore {
  constructor() {
    /** @type {Map<string, Array>} userId → entries[] (newest first) */
    this._store = new Map();
    this._load();
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  _load() {
    try {
      if (!fs.existsSync(STORE_PATH)) return;
      const raw     = fs.readFileSync(STORE_PATH, 'utf-8');
      const obj     = JSON.parse(raw);
      let loaded    = 0;
      for (const [userId, entries] of Object.entries(obj)) {
        const fresh = entries.filter(e => !isExpired(e));
        if (fresh.length) {
          this._store.set(userId, fresh);
          loaded++;
        }
      }
      if (loaded > 0) logger.info(`[contextStore] Loaded context for ${loaded} user(s).`);
    } catch (err) {
      logger.warn(`[contextStore] Could not load from disk: ${err.message}`);
    }
  }

  _save() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const obj = {};
      for (const [userId, entries] of this._store.entries()) {
        obj[userId] = entries;
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      logger.warn(`[contextStore] Could not save to disk: ${err.message}`);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Save a new entry for a user (newest first, capped at MAX_ENTRIES).
   * @param {string} userId
   * @param {{ tipo: string, ambiente: string, descripcion: string, report: object }} entry
   */
  save(userId, { tipo, ambiente, descripcion, report }) {
    const existing = this._store.get(userId) ?? [];
    const updated  = [
      { timestamp: Date.now(), tipo, ambiente, descripcion, report },
      ...existing.filter(e => !isExpired(e)),
    ].slice(0, MAX_ENTRIES);

    this._store.set(userId, updated);
    this._save();
    logger.info(`[contextStore] Saved entry for user ${userId} (total: ${updated.length}).`);
  }

  /**
   * Get the most recent non-expired entry for a user.
   * @param {string} userId
   * @returns {{ timestamp: number, tipo: string, ambiente: string, descripcion: string, report: object } | null}
   */
  getRecent(userId) {
    const entries = this._store.get(userId) ?? [];
    const fresh   = entries.filter(e => !isExpired(e));
    return fresh[0] ?? null;
  }

  /**
   * Get all non-expired entries for a user, newest first.
   * @param {string} userId
   * @returns {Array}
   */
  getAll(userId) {
    const entries = this._store.get(userId) ?? [];
    return entries.filter(e => !isExpired(e));
  }
}

// Export singleton — shared across all commands in the same process
module.exports = new ContextStore();
