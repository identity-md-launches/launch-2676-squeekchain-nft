import { useEffect, useId, useRef, useState } from "react";
import { parseUnits, formatUnits } from "viem";
import { useReadContract } from "wagmi";
import { Modal, LevelMarks } from "./bits";
import { STYLES, randomName, validName, type Style } from "../namegen";
import { namesAbi, erc20Abi, type Entry } from "../contract";
import { useCanWrite, useTarget, useTx, useSqueekMeta, type TxState } from "../hooks";
import { drawShareCard } from "../sharecard";
import type { HamsterStatus } from "../api";

function TxNote({ state, done }: { state: TxState; done: string }) {
  const text = state.phase === "wallet" ? "请在钱包里确认…" : state.phase === "confirming" ? "等待链上确认…" : state.phase === "done" ? done : state.phase === "error" ? state.message : "";
  return <p className={`note${state.phase === "error" ? " note-error" : ""}`} role="status">{text}</p>;
}

/** Why an onchain action is off right now, or null when it can run. */
function useBlocker(needsTips = false): string | null {
  const { net, live, tipsLive } = useTarget();
  const w = useCanWrite();
  if (!live) return `命名合约还没有部署到 ${net.label}，上线后这里就能使用。`;
  if (needsTips && !tipsLive) return "SQK 打赏还没有开启。";
  if (!w.connected) return "先点右上角 Connect 连接钱包。";
  if (!w.rightChain) return `请先切换到 ${net.label}。`;
  return null;
}

export function NameDialog({ tokenId, startRandom, onClose, onSaved, onDraft }: {
  tokenId: string | null; startRandom: boolean; onClose: () => void; onSaved: () => void; onDraft: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [style, setStyle] = useState<Style>("cute");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const tx = useTx();
  const { net } = useTarget();
  const blocker = useBlocker();
  const id = useId();

  useEffect(() => {
    if (tokenId === null) return;
    setName(startRandom ? randomName("cute") : "");
    setStyle("cute"); setError(""); tx.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenId, startRandom]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!validName(n)) {
      setError("用 1 到 20 个英文字母、数字、空格或连字符，例如 Mochi Bun。");
      inputRef.current?.focus();
      return;
    }
    setError("");
    if (blocker) return;
    void tx.run([{ address: net.names as `0x${string}`, abi: namesAbi, functionName: "setName", args: [BigInt(tokenId!), n], chainId: net.chainId }], onSaved);
  };

  return (
    <Modal open={tokenId !== null} onClose={onClose} title={`给 Squeek #${tokenId ?? ""} 起名字`}>
      <form onSubmit={submit} noValidate className="stack">
        <label htmlFor={`${id}-name`} className="label">英文昵称</label>
        <input id={`${id}-name`} ref={inputRef} className="input" value={name} maxLength={20} autoComplete="off" spellCheck={false}
          placeholder="Mochi Bun" aria-invalid={!!error} aria-describedby={`${id}-hint`}
          onChange={(e) => setName(e.target.value)} />
        <p id={`${id}-hint`} className={error ? "note note-error" : "note"}>{error || "1 到 20 个字符：英文字母、数字、空格或连字符。"}</p>
        <fieldset className="styles">
          <legend className="label">随机生成的风格</legend>
          <div className="chips">
            {STYLES.map((s) => (
              <label key={s.id} className="chip">
                <input type="radio" name={`${id}-style`} value={s.id} checked={style === s.id} onChange={() => setStyle(s.id)} />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => { setName(randomName(style)); setError(""); }}>随机生成</button>
        </fieldset>
        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={tx.busy || !!blocker}>{tx.busy ? "保存中…" : "保存到链上"}</button>
          <button type="button" className="btn" onClick={() => { const n = name.trim(); if (validName(n)) onDraft(n); else { setError("用 1 到 20 个英文字母、数字、空格或连字符，例如 Mochi Bun。"); inputRef.current?.focus(); } }}>用这个名字做分享卡片</button>
        </div>
        {blocker ? <p className="note">{blocker}</p> : <TxNote state={tx.state} done="名字已经存到链上了。" />}
      </form>
    </Modal>
  );
}

export function TipDialog({ entry, onClose, onDone }: { entry: Entry | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("10");
  const [error, setError] = useState("");
  const tx = useTx();
  const { net } = useTarget();
  const w = useCanWrite();
  const blocker = useBlocker(true);
  const id = useId();
  const enabled = !!entry && !blocker && !!w.address;
  const bal = useReadContract({ address: (net.sqk || undefined) as `0x${string}` | undefined, abi: erc20Abi, functionName: "balanceOf", args: [w.address!], chainId: net.chainId, query: { enabled } });
  const allowance = useReadContract({ address: (net.sqk || undefined) as `0x${string}` | undefined, abi: erc20Abi, functionName: "allowance", args: [w.address!, net.names as `0x${string}`], chainId: net.chainId, query: { enabled } });

  useEffect(() => { if (entry) { setAmount("10"); setError(""); tx.reset(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [entry]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let value: bigint;
    try { value = parseUnits(amount.trim(), 18); } catch { value = 0n; }
    if (value <= 0n) { setError("输入大于 0 的 SQK 数量，例如 10。"); return; }
    if (bal.data !== undefined && value > bal.data) { setError(`余额只有 ${formatUnits(bal.data, 18)} SQK，请减少数量。`); return; }
    setError("");
    if (blocker || !entry) return;
    const steps = [];
    if ((allowance.data ?? 0n) < value) steps.push({ address: net.sqk as `0x${string}`, abi: erc20Abi, functionName: "approve" as const, args: [net.names as `0x${string}`, value] as const, chainId: net.chainId });
    steps.push({ address: net.names as `0x${string}`, abi: namesAbi, functionName: "tip" as const, args: [entry.tokenId, value] as const, chainId: net.chainId });
    void tx.run(steps as never, () => { void bal.refetch(); void allowance.refetch(); onDone(); });
  };

  return (
    <Modal open={!!entry} onClose={onClose} title={`打赏 ${entry?.name ?? ""}`}>
      <form onSubmit={submit} noValidate className="stack">
        <label htmlFor={`${id}-amt`} className="label">打赏数量（SQK）</label>
        <input id={`${id}-amt`} className="input num" inputMode="decimal" autoComplete="off" value={amount}
          aria-invalid={!!error} aria-describedby={`${id}-hint`} onChange={(e) => setAmount(e.target.value)} />
        <p id={`${id}-hint`} className={error ? "note note-error" : "note"}>
          {error || (bal.data !== undefined ? `你的余额：${formatUnits(bal.data, 18)} SQK。SQK 会直接转给这只 Squeek 的持有者。` : "SQK 会直接转给这只 Squeek 的持有者。")}
        </p>
        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={tx.busy || !!blocker}>{tx.busy ? "打赏中…" : "发送打赏"}</button>
        </div>
        {blocker ? <p className="note">{blocker}</p> : <TxNote state={tx.state} done="打赏已送达，谢谢你！" />}
      </form>
    </Modal>
  );
}

export function ShareDialog({ card, hamster, onClose }: {
  card: { tokenId: string; name: string; likes: bigint } | null; hamster: HamsterStatus; onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const meta = useSqueekMeta(card?.tokenId ?? "0");
  const image = card ? meta.data?.image ?? null : null;
  const running = hamster.state === "unknown" ? null : hamster.state === "running";

  useEffect(() => {
    if (!card || !canvasRef.current) return;
    let alive = true;
    let made: string | null = null;
    void drawShareCard(canvasRef.current, { ...card, image, running }).then((b) => {
      if (!alive) return;
      made = URL.createObjectURL(b);
      setUrl(made);
    });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); setUrl(null); };
  }, [card, image, running]);

  const tweet = card
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`我的仓鼠 Squeek #${card.tokenId} 叫 ${card.name}，已经有 ${card.likes} 个赞了！ #SqueekChain`)}`
    : "#";

  return (
    <Modal open={!!card} onClose={onClose} title="分享卡片">
      <div className="stack">
        <canvas ref={canvasRef} className="share-canvas" role="img" aria-label={card ? `${card.name} 的分享卡片` : ""} />
        {card && <p className="note">Squeek #{card.tokenId} · {card.name} · <LevelMarks likes={card.likes} /> {card.likes.toString()} 个赞</p>}
        <div className="actions">
          <a className={`btn btn-primary${url ? "" : " is-off"}`} href={url ?? undefined} aria-disabled={!url}
            download={card ? `squeek-${card.tokenId}-${card.name.replace(/\s+/g, "-")}.png` : undefined}>下载图片</a>
          <a className="btn" href={tweet} target="_blank" rel="noopener noreferrer">分享到 Twitter</a>
        </div>
        <p className="note">先下载图片，再在 Twitter 发帖时把图片加进去。</p>
      </div>
    </Modal>
  );
}
