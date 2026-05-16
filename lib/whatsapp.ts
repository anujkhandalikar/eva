import Database from 'better-sqlite3';
import path from 'path';
import { resolveAlias } from './aliases';
import { fuzzyRank } from './fuzzy';

const DB_PATH = process.env.WHATSAPP_DB_PATH ??
  path.join(process.env.HOME ?? '', 'tools', 'whatsapp-mcp', 'whatsapp-bridge', 'store', 'messages.db');

const CONTACTS_DB_PATH = process.env.WHATSAPP_CONTACTS_DB_PATH ??
  path.join(path.dirname(DB_PATH), 'whatsapp.db');

const BRIDGE_URL = process.env.WHATSAPP_BRIDGE_URL ?? 'http://localhost:8080';

export type WaContact = {
  jid: string;
  name: string;
};

export type WaMessage = {
  id: string;
  timestamp: number;
  sender: string;
  chat_name: string;
  content: string;
  is_from_me: number;
  jid: string;
};

export type ProposedMessage = {
  recipient: string;
  recipient_name: string;
  body: string;
  alias?: string;
};

export type ResolvedRecipient = {
  jid: string;
  name: string;
  alias?: string;
};

function openDb(): Database.Database {
  return new Database(DB_PATH, { readonly: true, fileMustExist: true });
}

function loadContactsFromBook(includeGroups: boolean): WaContact[] {
  try {
    const cdb = new Database(CONTACTS_DB_PATH, { readonly: true, fileMustExist: true });
    try {
      const rows = cdb.prepare(`
        SELECT their_jid AS jid,
               COALESCE(NULLIF(full_name,''),
                        NULLIF(first_name,''),
                        NULLIF(push_name,''),
                        NULLIF(business_name,''),
                        their_jid) AS name
        FROM whatsmeow_contacts
        WHERE their_jid IS NOT NULL AND their_jid != ''
      `).all() as WaContact[];
      if (!includeGroups) return rows.filter(r => !r.jid.endsWith('@g.us'));
      return rows;
    } finally {
      cdb.close();
    }
  } catch (e) {
    console.warn('[whatsapp] failed to read contacts book:', (e as Error).message);
    return [];
  }
}

export function searchContacts(query: string, includeGroups = true): WaContact[] {
  const db = openDb();
  try {
    const groupFilter = includeGroups ? '' : "AND jid NOT LIKE '%@g.us'";
    const stmt = db.prepare(`
      SELECT DISTINCT jid, name
      FROM chats
      WHERE (LOWER(name) LIKE LOWER(?) OR LOWER(jid) LIKE LOWER(?))
        ${groupFilter}
      ORDER BY name, jid
      LIMIT 10
    `);

    // Try full query first against chats
    let rows = stmt.all(`%${query}%`, `%${query}%`) as WaContact[];

    // If no results, try each word individually against chats
    if (rows.length === 0) {
      const words = query.split(/\s+/).filter(w => w.length > 1);
      const seen = new Set<string>();
      for (const word of words) {
        const wordRows = stmt.all(`%${word}%`, `%${word}%`) as WaContact[];
        for (const r of wordRows) {
          if (!seen.has(r.jid)) { seen.add(r.jid); rows.push(r); }
        }
      }
    }

    // Still nothing — search the contacts book (contacts you have never chatted with)
    // first by substring, then by fuzzy.
    if (rows.length === 0) {
      const book = loadContactsFromBook(includeGroups);
      const ql = query.toLowerCase();
      const sub = book.filter(c => c.name.toLowerCase().includes(ql));
      if (sub.length > 0) {
        rows = sub.slice(0, 10);
        console.log(`[whatsapp] book-substring("${query}") → ${rows.length}`, rows.map(r => r.name));
      } else {
        const chats = db.prepare(`
          SELECT DISTINCT jid, name FROM chats
          WHERE name IS NOT NULL AND name != ''
          ${groupFilter}
        `).all() as WaContact[];
        const combined = [...chats, ...book];
        const ranked = fuzzyRank(query, combined, c => c.name);
        rows = dedupeByJid(ranked.map(m => m.item)).slice(0, 10);
        if (rows.length > 0) {
          console.log(`[whatsapp] fuzzy("${query}") → ${rows.length}`, rows.map(r => r.name));
        }
      }
    }

    console.log(`[whatsapp] searchContacts("${query}") → ${rows.length} results`, rows.map(r => r.name));
    return rows;
  } finally {
    db.close();
  }
}

function dedupeByJid(items: WaContact[]): WaContact[] {
  const seen = new Set<string>();
  const out: WaContact[] = [];
  for (const it of items) {
    if (seen.has(it.jid)) continue;
    seen.add(it.jid);
    out.push(it);
  }
  return out;
}

export function findChatByExactName(name: string, isGroup: boolean): WaContact | null {
  const db = openDb();
  try {
    const jidFilter = isGroup ? "AND jid LIKE '%@g.us'" : "AND jid NOT LIKE '%@g.us'";
    const row = db.prepare(`
      SELECT jid, name
      FROM chats
      WHERE LOWER(name) = LOWER(?)
        ${jidFilter}
      ORDER BY name
      LIMIT 1
    `).get(name) as WaContact | undefined;
    return row ?? null;
  } finally {
    db.close();
  }
}

export function resolveRecipient(query: string): ResolvedRecipient | null {
  const alias = resolveAlias(query);
  if (alias) {
    const hit = findChatByExactName(alias.realName, alias.isGroup);
    if (hit) {
      console.log(`[whatsapp] alias "${query}" → "${alias.realName}" (${alias.isGroup ? 'group' : 'contact'}) → ${hit.jid}`);
      return { jid: hit.jid, name: hit.name, alias: query.trim() };
    }
    console.warn(`[whatsapp] alias "${query}" maps to "${alias.realName}" but no chat found — falling back to search`);
  }
  const contacts = searchContacts(query);
  if (contacts.length === 0) return null;
  return { jid: contacts[0].jid, name: contacts[0].name };
}

export function getLastMessage(jid: string): WaMessage | null {
  const db = openDb();
  try {
    const row = db.prepare(`
      SELECT m.id, m.timestamp, m.sender, c.name as chat_name, m.content,
             m.is_from_me, c.jid
      FROM messages m
      JOIN chats c ON m.chat_jid = c.jid
      WHERE m.sender = ? OR c.jid = ?
      ORDER BY m.timestamp DESC
      LIMIT 1
    `).get(jid, jid) as WaMessage | undefined;
    return row ?? null;
  } finally {
    db.close();
  }
}

export function listRecentMessages(jid: string, limit = 10): WaMessage[] {
  const db = openDb();
  try {
    const rows = db.prepare(`
      SELECT m.id, m.timestamp, m.sender, c.name as chat_name, m.content,
             m.is_from_me, c.jid
      FROM messages m
      JOIN chats c ON m.chat_jid = c.jid
      WHERE c.jid = ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `).all(jid, limit) as WaMessage[];
    return rows;
  } finally {
    db.close();
  }
}

export async function sendMessage(recipient: string, message: string): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, message }),
  });

  const data = await res.json() as { success: boolean; message: string };
  if (!res.ok || !data.success) {
    throw new Error(`WhatsApp send failed: ${data.message}`);
  }
}
