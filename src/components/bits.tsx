import { useEffect, useRef, type ReactNode } from "react";
import type { HamsterStatus } from "../api";
import { levelLabel, levelOf } from "../level";
import { useSqueekMeta } from "../hooks";

/** Star, moon and sun marks. One 24px grid, filled, recolored by CSS. */
export const STAR_PATH = "M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z";
export const MOON_PATH = "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z";
const Sun = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="lv lv-sun">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export function LevelMarks({ likes }: { likes: bigint | number }) {
  const l = levelOf(likes);
  const label = levelLabel(l);
  return (
    <span className="marks" role="img" aria-label={label} title={label}>
      {Array.from({ length: l.suns }, (_, i) => <Sun key={`s${i}`} />)}
      {Array.from({ length: l.moons }, (_, i) => <svg key={`m${i}`} viewBox="0 0 24 24" aria-hidden="true" className="lv lv-moon"><path d={MOON_PATH} /></svg>)}
      {Array.from({ length: l.stars }, (_, i) => <svg key={`t${i}`} viewBox="0 0 24 24" aria-hidden="true" className="lv lv-star"><path d={STAR_PATH} /></svg>)}
    </span>
  );
}

/** 🔥 while the hamster runs, 💤 while it sleeps, as the brief asks; the label carries the state in words. */
export function HamsterIcon({ status }: { status: HamsterStatus }) {
  const [glyph, label] = status.state === "running" ? ["🔥", "仓鼠正在跑轮"] : status.state === "sleeping" ? ["💤", "仓鼠在睡觉"] : ["…", "仓鼠状态读取中"];
  return <span className={`hamster-icon is-${status.state}`} role="img" aria-label={label} title={label}>{glyph}</span>;
}

export function SqueekImage({ tokenId, size = 160 }: { tokenId: string; size?: number }) {
  const q = useSqueekMeta(tokenId);
  if (q.data?.image) return <img className="squeek-img" src={q.data.image} width={size} height={size} alt={`Squeek #${tokenId}`} loading="lazy" decoding="async" />;
  return (
    <div className="squeek-img squeek-ph" style={{ width: size, height: size }} aria-label={q.isError ? "图片加载失败" : "图片加载中"} role="img">
      <HamsterArt />
    </div>
  );
}

/** The site's cartoon hamster, used for the logo, placeholders and empty states. */
export function HamsterArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="17" cy="16" r="8" fill="#F2A65A" /><circle cx="17" cy="16" r="4" fill="#F7C6C0" />
      <circle cx="47" cy="16" r="8" fill="#F2A65A" /><circle cx="47" cy="16" r="4" fill="#F7C6C0" />
      <ellipse cx="32" cy="36" rx="24" ry="22" fill="#F2A65A" />
      <ellipse cx="32" cy="42" rx="16" ry="13" fill="#FFF3DC" />
      <circle cx="23" cy="31" r="3.2" fill="#3B2A1A" /><circle cx="41" cy="31" r="3.2" fill="#3B2A1A" />
      <circle cx="24" cy="30" r="1" fill="#fff" /><circle cx="42" cy="30" r="1" fill="#fff" />
      <ellipse cx="32" cy="37" rx="2.6" ry="1.8" fill="#C0645A" />
      <circle cx="17" cy="39" r="3.5" fill="#F7A8A0" opacity=".7" /><circle cx="47" cy="39" r="3.5" fill="#F7A8A0" opacity=".7" />
    </svg>
  );
}

/** Native modal dialog: inert background, Escape, focus return. Closes by backdrop, Escape or ×. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-label={title} onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {open && (
        <div className="sheet-body">
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="x" aria-label="Close" onClick={onClose}>×</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
