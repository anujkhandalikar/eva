import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.WHATSAPP_DB_PATH ??
  path.join(process.env.HOME ?? '', 'tools', 'whatsapp-mcp', 'whatsapp-bridge', 'store', 'messages.db');

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
};

function openDb(): Database.Database {
  return new Database(DB_PATH, { readonly: true, fileMustExist: true });
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

    // Try full query first
    let rows = stmt.all(`%${query}%`, `%${query}%`) as WaContact[];

    // If no results, try each word individually and union results
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

    console.log(`[whatsapp] searchContacts("${query}") → ${rows.length} results`, rows.map(r => r.name));
    return rows;
  } finally {
    db.close();
  }
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
