import fs from 'fs';
import path from 'path';
import { resolveRecipient, sendMessage } from '../whatsapp';

export type WhatsappSendPayload = {
  recipient: string;
  message?: string;
  media_path?: string;
};

export async function handleWhatsappSend(payload: WhatsappSendPayload): Promise<void> {
  const { recipient, message, media_path } = payload;

  if (!recipient) throw new Error('Recipient required');
  if (!message && !media_path) throw new Error('Message or media_path required');

  if (media_path) {
    if (!path.isAbsolute(media_path)) {
      throw new Error(`Media path must be absolute: ${media_path}`);
    }
    if (!fs.existsSync(media_path)) {
      throw new Error(`Media file missing: ${media_path}`);
    }
  }

  const r = resolveRecipient(recipient);
  if (!r) throw new Error(`Recipient not found: ${recipient}`);

  await sendMessage(r.jid, message ?? '', media_path);
}
