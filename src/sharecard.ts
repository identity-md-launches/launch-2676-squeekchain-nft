import { levelOf } from "./level";

const W = 1200;
const H = 630;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("image"));
    i.src = src;
  });
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
}

function moon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, bg: string) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  const keep = ctx.fillStyle;
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(cx + r * 0.45, cy - r * 0.3, r * 0.85, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = keep;
}

function sun(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = r * 0.16; ctx.lineCap = "round"; ctx.strokeStyle = ctx.fillStyle;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
}

export interface CardInput { tokenId: string; name: string; likes: bigint; image: string | null; running: boolean | null }

/** Draws the 1200×630 share card (Twitter's summary_large_image size) and returns a PNG blob. */
export async function drawShareCard(c: HTMLCanvasElement, input: CardInput): Promise<Blob> {
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const font = 'ui-rounded, "SF Pro Rounded", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
  const bg = "#FFD84D";
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#FFE98A";
  for (let x = 30; x < W; x += 60) for (let y = 30; y < H; y += 60) { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); }

  // Portrait panel
  ctx.fillStyle = "#FFFBEA";
  ctx.beginPath(); ctx.roundRect(60, 75, 480, 480, 40); ctx.fill();
  if (input.image) {
    try {
      const img = await loadImage(input.image);
      ctx.save(); ctx.beginPath(); ctx.roundRect(80, 95, 440, 440, 28); ctx.clip();
      ctx.drawImage(img, 80, 95, 440, 440); ctx.restore();
    } catch { /* keep the empty panel */ }
  }

  ctx.fillStyle = "#3B2A1A";
  ctx.font = `600 34px ${font}`;
  ctx.fillText(`Squeek #${input.tokenId}`, 600, 150);
  ctx.font = `800 ${input.name.length > 14 ? 64 : 84}px ${font}`;
  ctx.fillText(input.name, 600, 250, 560);

  const l = levelOf(input.likes);
  let x = 620;
  const y = 330;
  ctx.fillStyle = "#B4570B";
  for (let i = 0; i < l.suns; i++, x += 64) sun(ctx, x, y, 26);
  for (let i = 0; i < l.moons; i++, x += 60) moon(ctx, x, y, 24, bg);
  for (let i = 0; i < l.stars; i++, x += 56) star(ctx, x, y, 26);
  ctx.fillStyle = "#3B2A1A";
  ctx.font = `600 34px ${font}`;
  ctx.fillText(`${input.likes.toString()} 个赞`, x === 620 ? 600 : x + 4, y + 12);

  if (input.running !== null) {
    ctx.font = `600 30px ${font}`;
    ctx.fillText(input.running ? "🔥 正在跑轮" : "💤 正在睡觉", 600, 420);
  }
  ctx.font = `600 28px ${font}`;
  ctx.fillStyle = "#6B4A12";
  ctx.fillText("Squeek 起名屋 · SqueekChain", 600, 520);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png"));
}
