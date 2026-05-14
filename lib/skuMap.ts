export const SKU_MAP: Record<string, { id: string; name: string; url: string }> = {
  "diet coke":    { id: "15288",  name: "Coca-Cola Diet Coke",           url: "https://blinkit.com/prn/coca-cola-diet-coke-soft-drink/prid/15288" },
  "coke diet":    { id: "15288",  name: "Coca-Cola Diet Coke",           url: "https://blinkit.com/prn/coca-cola-diet-coke-soft-drink/prid/15288" },
  "paneer":       { id: "703472", name: "Akshayakalpa Paneer",           url: "https://blinkit.com/prn/akshayakalpa-organic-high-protein-paneer/prid/703472" },
  "chicken":      { id: "443860", name: "Licious Chicken Curry Cut",     url: "https://blinkit.com/prn/licious-chicken-curry-cut-large-7-to-11-pcs/prid/443860" },
  "batter":       { id: "17772",  name: "iD Idli Dosa Batter 1kg",      url: "https://blinkit.com/prn/id-idli-dosa-batter-1-kg/prid/17772" },
  "idli batter":  { id: "17772",  name: "iD Idli Dosa Batter 1kg",      url: "https://blinkit.com/prn/id-idli-dosa-batter-1-kg/prid/17772" },
  "dosa batter":  { id: "17772",  name: "iD Idli Dosa Batter 1kg",      url: "https://blinkit.com/prn/id-idli-dosa-batter-1-kg/prid/17772" },
  "garlic paste": { id: "122155", name: "Smith & Jones Garlic Paste",    url: "https://blinkit.com/prn/smith-jones-ginger-garlic-paste/prid/122155" },
  "ginger garlic":{ id: "122155", name: "Smith & Jones Garlic Paste",    url: "https://blinkit.com/prn/smith-jones-ginger-garlic-paste/prid/122155" },
  "tomato":       { id: "609555", name: "Organic Tomato",                url: "https://blinkit.com/prn/organically-grown-tomato-desi-tomaato/prid/609555" },
  "onion":        { id: "530158", name: "Onion",                         url: "https://blinkit.com/prn/onion-eerulli/prid/530158" },
  "eggs":         { id: "498143", name: "Licious White Eggs",            url: "https://blinkit.com/prn/licious-farm-fresh-classic-white-eggs/prid/498143" },
  "white eggs":   { id: "498143", name: "Licious White Eggs",            url: "https://blinkit.com/prn/licious-farm-fresh-classic-white-eggs/prid/498143" },
};

export function lookupSKU(input: string): { id: string; name: string; url: string } | null {
  const lower = input.toLowerCase();
  // Check longer keywords first to avoid "garlic paste" matching just "garlic"
  const sorted = Object.entries(SKU_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, sku] of sorted) {
    if (lower.includes(keyword)) return sku;
  }
  return null;
}

export function parseQuantity(input: string): number {
  const match = input.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}
