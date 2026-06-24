export type WhatsAppAlias = {
  alias: string;
  realName: string;
  isGroup: boolean;
};

export const WHATSAPP_ALIASES: WhatsAppAlias[] = [
  { alias: "ghar",       realName: "Ghar :D",          isGroup: true  },
  { alias: "chai",       realName: "Chai",             isGroup: false },
  { alias: "dildo",      realName: "New Dil do Group", isGroup: true  },
  { alias: "dee",        realName: "Deepankuri",       isGroup: false },
  { alias: "vedi bahin", realName: "Vedi Bahin",       isGroup: false },
];

export function resolveAlias(query: string): WhatsAppAlias | null {
  const q = query.trim().toLowerCase();
  return WHATSAPP_ALIASES.find((a) => a.alias.trim().toLowerCase() === q) ?? null;
}
