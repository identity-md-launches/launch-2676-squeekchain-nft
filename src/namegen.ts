export type Style = "cute" | "bold" | "funny";

export const STYLES: ReadonlyArray<{ id: Style; label: string }> = [
  { id: "cute", label: "可爱风" },
  { id: "bold", label: "霸气风" },
  { id: "funny", label: "搞笑风" },
];

const WORDS: Record<Style, { first: string[]; last: string[] }> = {
  cute: {
    first: ["Mochi", "Peanut", "Biscuit", "Honey", "Pudding", "Button", "Nibbles", "Cookie", "Muffin", "Sunny", "Tofu", "Puff", "Sesame", "Dumpling", "Maple"],
    last: ["Bun", "Paws", "Cheeks", "Pop", "Bean", "Puff", "Drop", "Sprout", "Whisker", "Bell"],
  },
  bold: {
    first: ["Thunder", "Iron", "Blaze", "Titan", "Storm", "Rex", "Viper", "Atlas", "Nova", "Onyx", "Fang", "Bolt", "Rogue", "Max", "Ace"],
    last: ["Claw", "Fury", "Strike", "King", "Fang", "Wheel", "Rider", "Breaker", "Rush", "Baron"],
  },
  funny: {
    first: ["Sir", "Captain", "Lord", "Professor", "Agent", "Doctor", "Duke", "Chef", "Uncle", "Baron"],
    last: ["Snackalot", "Wobbles", "Cheeksworth", "Napsalot", "Crumbs", "Fluffbutt", "Seedhoard", "Zoomies", "Snorebert", "Pocketful"],
  },
};

/** A random English name of at most 20 characters in the chosen style. */
export function randomName(style: Style, rand: () => number = Math.random): string {
  const { first, last } = WORDS[style];
  const pick = (a: string[]) => a[Math.floor(rand() * a.length)]!;
  for (let i = 0; i < 20; i++) {
    const n = `${pick(first)} ${pick(last)}`;
    if (n.length <= 20) return n;
  }
  return pick(first);
}

/** Mirrors SqueekNames.validName: 1-20 of A-Z a-z 0-9 space hyphen, no edge spaces. */
export const NAME_PATTERN = /^[A-Za-z0-9-](?:[A-Za-z0-9 -]{0,18}[A-Za-z0-9-])?$/;
export const validName = (n: string) => NAME_PATTERN.test(n);
