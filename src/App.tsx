import { useEffect, useId, useState } from "react";
import { isAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ConnectSheet } from "./components/ConnectSheet";
import { HamsterArt, HamsterIcon, LevelMarks, SqueekImage } from "./components/bits";
import { NameDialog, ShareDialog, TipDialog } from "./components/Dialogs";
import { useAccountSqueeks, useCanWrite, useHamster, useNameBook, useReducedMotion, useTarget, useTx } from "./hooks";
import { namesAbi, weekStart, type Entry } from "./contract";
import { toNextStar } from "./level";
import type { HamsterStatus } from "./api";

const fmtDate = (d: Date) => `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;

function HamsterPill({ status }: { status: HamsterStatus }) {
  const text = status.state === "running" ? `在跑轮 · ${Math.round(status.rpm ?? 0)} 转/分` : status.state === "sleeping" ? "在睡觉" : "读取中";
  return (
    <span className="pill" role="status" aria-live="polite">
      <HamsterIcon status={status} /> <span>仓鼠{text}</span>
    </span>
  );
}

/** Top three names of last week, one at a time. Auto-advance stops under reduced motion and on pause. */
function Banner({ leaders, live, lastWeek }: { leaders: Entry[]; live: boolean; lastWeek: number }) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = leaders.length;
  useEffect(() => {
    if (reduced || paused || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 4000);
    return () => clearInterval(t);
  }, [reduced, paused, n]);
  const start = weekStart(lastWeek);
  const end = new Date(start.getTime() + 6 * 86400_000);
  const period = `${fmtDate(start)}–${fmtDate(end)}`;
  const e = leaders[i % Math.max(1, n)];
  return (
    <section className="banner" aria-label="每周排行榜">
      <div className="wrap banner-row">
        <span className="banner-title">本周之星 <span className="muted">{period}</span></span>
        {!live ? (
          <span className="banner-msg">排行榜会在命名合约上线后开始，每周一更新。</span>
        ) : n === 0 ? (
          <span className="banner-msg">上周还没有点赞。本周得赞最多的名字，下周一会出现在这里。</span>
        ) : (
          <>
            <span className="banner-msg banner-item" aria-live={paused || reduced ? "polite" : "off"}>
              <span className="rank">第 {(i % n) + 1} 名</span> <strong>{e!.name}</strong> <span className="muted">#{e!.tokenId.toString()}</span> · {e!.weekLikes.toString()} 赞
            </span>
            {n > 1 && (
              <span className="banner-ctl">
                <button className="btn btn-sm" onClick={() => setI((x) => (x + n - 1) % n)} aria-label="上一名">‹</button>
                {!reduced && <button className="btn btn-sm" onClick={() => setPaused((p) => !p)} aria-label={paused ? "继续滚动" : "暂停滚动"}>{paused ? "▶" : "❚❚"}</button>}
                <button className="btn btn-sm" onClick={() => setI((x) => (x + 1) % n)} aria-label="下一名">›</button>
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
}

interface CardProps {
  tokenId: string;
  entry: Entry | undefined;
  mine: boolean;
  hamster: HamsterStatus;
  onName: (random: boolean) => void;
  onTip: (e: Entry) => void;
  onShare: (name: string, likes: bigint) => void;
  onLiked: () => void;
}

function SqueekCard({ tokenId, entry, mine, hamster, onName, onTip, onShare, onLiked }: CardProps) {
  const { net, live } = useTarget();
  const w = useCanWrite();
  const tx = useTx();
  const liked = useReadContract({
    address: (net.names || undefined) as `0x${string}` | undefined, abi: namesAbi, functionName: "hasLiked",
    args: [BigInt(tokenId), entry?.version ?? 0, w.address!], chainId: net.chainId,
    query: { enabled: live && !!entry && !!w.address },
  });
  const named = !!entry && entry.version > 0;
  const likes = entry?.likes ?? 0n;
  const like = () => void tx.run([{ address: net.names as `0x${string}`, abi: namesAbi, functionName: "like", args: [BigInt(tokenId)], chainId: net.chainId }], () => { void liked.refetch(); onLiked(); });
  const likeOff = !live ? "命名合约上线后可以点赞" : !named ? "起名后才能点赞" : !w.connected ? "连接钱包后可以点赞" : !w.rightChain ? `切换到 ${net.label} 后可以点赞` : liked.data ? "你已经点过赞" : "";

  return (
    <li className="card">
      <SqueekImage tokenId={tokenId} />
      <div className="card-body">
        <p className="card-id">Squeek #{tokenId}</p>
        <h3 className="card-name">
          {named ? entry!.name : <span className="muted">还没有名字</span>} <HamsterIcon status={hamster} />
        </h3>
        <p className="card-level"><LevelMarks likes={likes} /> <span className="num">{likes.toString()}</span> 赞
          {named && <span className="muted"> · 再得 {toNextStar(likes)} 赞加一颗星</span>}</p>
        <div className="card-actions">
          {mine && <button className="btn btn-primary" onClick={() => onName(false)}>起名字</button>}
          {mine && <button className="btn" onClick={() => onName(true)}>随机生成</button>}
          {!mine && (
            <button className="btn" onClick={like} disabled={!!likeOff || tx.busy} title={likeOff || undefined} aria-describedby={likeOff ? `why-${tokenId}` : undefined}>
              {tx.busy ? "点赞中…" : liked.data ? "已点赞" : "点赞"}
            </button>
          )}
          {!mine && <button className="btn" onClick={() => entry && onTip(entry)} disabled={!named}>打赏 SQK</button>}
          <button className="btn" onClick={() => onShare(named ? entry!.name : `Squeek #${tokenId}`, likes)}>分享卡片</button>
        </div>
        {!mine && likeOff && <p id={`why-${tokenId}`} className="note">{likeOff}</p>}
        {tx.state.phase !== "idle" && <p className={`note${tx.state.phase === "error" ? " note-error" : ""}`} role="status">
          {tx.state.phase === "wallet" ? "请在钱包里确认…" : tx.state.phase === "confirming" ? "等待链上确认…" : tx.state.phase === "done" ? "点赞成功！" : tx.state.phase === "error" ? tx.state.message : ""}
        </p>}
      </div>
    </li>
  );
}

export default function App() {
  const { address } = useAccount();
  const hamster = useHamster();
  const book = useNameBook();
  const { net } = useTarget();
  const [lookup, setLookup] = useState("");
  const [viewing, setViewing] = useState<string | undefined>(undefined);
  const [lookupError, setLookupError] = useState("");
  const shown = viewing ?? address;
  const mineView = !!address && !!shown && shown.toLowerCase() === address.toLowerCase();
  const account = useAccountSqueeks(shown);
  const [naming, setNaming] = useState<{ tokenId: string; random: boolean } | null>(null);
  const [tipping, setTipping] = useState<Entry | null>(null);
  const [card, setCard] = useState<{ tokenId: string; name: string; likes: bigint } | null>(null);
  const lookupId = useId();

  useEffect(() => { if (address) setViewing(undefined); }, [address]);

  const onLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const v = lookup.trim();
    if (!isAddress(v)) { setLookupError("输入以 0x 开头的 42 位钱包地址。"); return; }
    setLookupError(""); setViewing(v);
  };

  const tokens = account.data?.tokens ?? [];
  const wall = [...book.byToken.values()].sort((a, b) => (b.likes > a.likes ? 1 : b.likes < a.likes ? -1 : 0)).slice(0, 24);

  return (
    <>
      <a className="skip" href="#main">跳到正文</a>
      <Banner leaders={book.leaders} live={book.live} lastWeek={book.lastWeek} />
      <header className="header">
        <div className="wrap header-row">
          <a className="logo" href="./" aria-label="Squeek 起名屋 首页"><HamsterArt className="logo-art" /><span>Squeek 起名屋</span></a>
          <div className="header-end">
            <HamsterPill status={hamster} />
            <ConnectSheet targetChainId={net.chainId} />
          </div>
        </div>
      </header>

      <main id="main" className="wrap">
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">给你的仓鼠起个名字</h1>
          <p className="lead">连接钱包，挑一只 Squeek，起个英文昵称存到链上，收集点赞和 SQK 打赏。</p>
        </section>

        <section className="panel" aria-labelledby="mine-title">
          <div className="panel-head">
            <h2 id="mine-title">{mineView ? "我的 Squeek" : shown ? "这个地址的 Squeek" : "我的 Squeek"}</h2>
            {account.data && <span className="muted num">{account.data.total} 只 · 数据来自 {net.label}</span>}
          </div>
          {!shown && (
            <div className="empty">
              <p><strong>连接钱包，看看你有哪些 Squeek。</strong></p>
              <ConnectSheet targetChainId={net.chainId} />
            </div>
          )}
          <form className="lookup" onSubmit={onLookup} noValidate>
            <label htmlFor={lookupId} className="label">{address ? "查看别人的 Squeek：输入钱包地址" : "或者输入钱包地址查看"}</label>
            <div className="lookup-row">
              <input id={lookupId} className="input mono" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="0x1234…abcd"
                autoComplete="off" spellCheck={false} aria-invalid={!!lookupError} aria-describedby={`${lookupId}-err`} />
              <button className="btn" type="submit">查看</button>
              {viewing && address && <button className="btn" type="button" onClick={() => setViewing(undefined)}>回到我的</button>}
            </div>
            <p id={`${lookupId}-err`} className="note note-error" role="status">{lookupError}</p>
          </form>
          {shown && account.isLoading && <p className="note" role="status">正在读取 Squeek…</p>}
          {shown && account.isError && (
            <p className="note note-error" role="alert">暂时读不到 api.squeekchain.com 的数据。<button className="btn btn-sm" onClick={() => void account.refetch()}>重试</button></p>
          )}
          {shown && account.data && tokens.length === 0 && (
            <div className="empty"><HamsterArt className="empty-art" /><p>这个地址还没有 Squeek。可以输入另一个地址看看。</p></div>
          )}
          {tokens.length > 0 && (
            <ul className="grid">
              {tokens.map((t) => (
                <SqueekCard key={t.tokenId} tokenId={t.tokenId} entry={book.byToken.get(t.tokenId)} mine={mineView} hamster={hamster}
                  onName={(random) => setNaming({ tokenId: t.tokenId, random })} onTip={setTipping}
                  onShare={(name, likes) => setCard({ tokenId: t.tokenId, name, likes })} onLiked={book.refetch} />
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="wall-title">
          <div className="panel-head"><h2 id="wall-title">名字墙</h2><span className="muted">得赞最多的名字</span></div>
          {!book.live && <p className="note">命名合约部署到 {net.label} 后，所有人起的名字都会出现在这里，可以点赞和打赏。</p>}
          {book.live && book.loading && <p className="note" role="status">正在读取链上的名字…</p>}
          {book.failed && <p className="note note-error" role="alert">读不到链上的名字，请稍后刷新。</p>}
          {book.live && !book.loading && !book.failed && wall.length === 0 && <p className="note">还没有人起名。连接钱包，给你的 Squeek 起第一个名字。</p>}
          {wall.length > 0 && (
            <ul className="grid">
              {wall.map((e) => (
                <SqueekCard key={e.tokenId.toString()} tokenId={e.tokenId.toString()} entry={e}
                  mine={!!address && e.namedBy.toLowerCase() === address.toLowerCase()} hamster={hamster}
                  onName={(random) => setNaming({ tokenId: e.tokenId.toString(), random })} onTip={setTipping}
                  onShare={(name, likes) => setCard({ tokenId: e.tokenId.toString(), name, likes })} onLiked={book.refetch} />
              ))}
            </ul>
          )}
        </section>

        <section className="panel rules" aria-labelledby="rules-title">
          <h2 id="rules-title">星光等级</h2>
          <ul className="rule-list">
            <li><LevelMarks likes={100} /> 每 100 个赞加 1 颗星，最多 9 颗</li>
            <li><LevelMarks likes={1000} /> 1,000 个赞变成 1 个月亮，1,100 赞是 1 个月亮加 1 颗星</li>
            <li><LevelMarks likes={10000} /> 10,000 个赞变成 1 个太阳</li>
            <li><HamsterIcon status={{ state: "running", rpm: null, speedMmPerSecond: null, observedAt: null }} /> 仓鼠在跑轮，<HamsterIcon status={{ state: "sleeping", rpm: null, speedMmPerSecond: null, observedAt: null }} /> 仓鼠在睡觉，每 5 秒刷新</li>
          </ul>
        </section>
      </main>

      <footer className="footer wrap">
        <p className="muted">数据来自 api.squeekchain.com 和 {net.label} 上的合约。每个地址对一个名字只能点一次赞，持有者不能给自己点赞。</p>
      </footer>

      <NameDialog tokenId={naming?.tokenId ?? null} startRandom={naming?.random ?? false} onClose={() => setNaming(null)}
        onSaved={book.refetch} onDraft={(name) => { const id = naming!.tokenId; setNaming(null); setCard({ tokenId: id, name, likes: book.byToken.get(id)?.likes ?? 0n }); }} />
      <TipDialog entry={tipping} onClose={() => setTipping(null)} onDone={book.refetch} />
      <ShareDialog card={card} hamster={hamster} onClose={() => setCard(null)} />
    </>
  );
}
