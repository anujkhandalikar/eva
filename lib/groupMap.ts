import { SKU_MAP } from "./skuMap";

export type GroupItem = { sku: string; defaultQty: number };
export type Group = { keywords: string[]; items: GroupItem[] };

export const GROUP_MAP: Group[] = [
  {
    keywords: ["vegetables", "veggies", "sabzi"],
    items: [
      { sku: "tomato",  defaultQty: 1 },
      { sku: "onion",   defaultQty: 1 },
      { sku: "spinach", defaultQty: 1 },
    ],
  },
  {
    keywords: ["usual groceries", "weekly groceries", "regular groceries"],
    items: [
      { sku: "chicken", defaultQty: 3 },
      { sku: "paneer",  defaultQty: 3 },
      { sku: "batter",  defaultQty: 1 },
    ],
  },
];

export function lookupGroup(input: string): Group | null {
  const lower = input.toLowerCase();
  const flat: { keyword: string; group: Group }[] = [];
  for (const group of GROUP_MAP) {
    for (const keyword of group.keywords) {
      flat.push({ keyword, group });
    }
  }
  flat.sort((a, b) => b.keyword.length - a.keyword.length);
  for (const { keyword, group } of flat) {
    if (lower.includes(keyword)) return group;
  }
  return null;
}

export function expandGroup(
  group: Group,
  scale: number
): { name: string; quantity: number }[] {
  const multiplier = scale > 0 ? scale : 1;
  return group.items.map((item) => {
    if (!(item.sku in SKU_MAP)) {
      throw new Error(
        `Group references unknown SKU "${item.sku}". Add it to lib/skuMap.ts before this group can be ordered.`
      );
    }
    return { name: item.sku, quantity: item.defaultQty * multiplier };
  });
}
