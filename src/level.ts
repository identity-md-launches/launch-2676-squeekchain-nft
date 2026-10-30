/** Like levels: every 100 likes is a star, 1,000 a moon, 10,000 a sun. 1,100 = 1 moon + 1 star. */
export interface Level { suns: number; moons: number; stars: number }

export function levelOf(likes: number | bigint): Level {
  const n = typeof likes === "bigint" ? likes : BigInt(Math.max(0, Math.floor(likes)));
  return {
    suns: Number(n / 10000n),
    moons: Number((n % 10000n) / 1000n),
    stars: Number((n % 1000n) / 100n),
  };
}

export function levelLabel(l: Level): string {
  const parts: string[] = [];
  if (l.suns) parts.push(`${l.suns} 个太阳`);
  if (l.moons) parts.push(`${l.moons} 个月亮`);
  if (l.stars) parts.push(`${l.stars} 颗星`);
  return parts.length ? parts.join(" ") : "还没有星光";
}

/** Likes still needed for the next star. */
export const toNextStar = (likes: number | bigint) => 100 - Number(BigInt(likes) % 100n);
