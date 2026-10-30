import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain, type Connector } from "wagmi";
import { WALLET_ICONS } from "../wallet-icons";
import { OPEN_IN, isMobileBrowser } from "../open-in";
import { NETWORKS, type ChainId } from "../config";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** The connect control and its sheet: the site's own type and colors, the network's structure. */
export function ConnectSheet({ targetChainId }: { targetChainId: ChainId }) {
  const mobile = isMobileBrowser();
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending, variables, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => { if (isConnected) setOpen(false); }, [isConnected]);

  // EIP-6963 names each installed extension; wagmi's generic injected row is only for a browser
  // where discovery found nothing, and then it is called what it is.
  const named = connectors.some((c) => c.type === "injected" && c.id !== "injected");
  const listed = [...connectors.filter((c) => c.type === "injected"), ...connectors.filter((c) => c.type !== "injected")]
    .filter((c) => !(c.id === "injected" && named));
  const label = (c: Connector) => (c.id === "injected" ? "Browser wallet" : c.id === "coinbaseWalletSDK" && mobile ? "Coinbase Smart Wallet" : c.name);
  const icon = (c: Connector) => c.icon ?? (WALLET_ICONS[c.id] ? svgUri(WALLET_ICONS[c.id]!) : undefined);
  const target = NETWORKS[targetChainId];

  if (isConnected && address) {
    if (chainId !== targetChainId && target) {
      return (
        <button className="btn btn-primary" onClick={() => switchChain({ chainId: targetChainId })} disabled={switching}>
          {switching ? "切换中…" : `Switch to ${target.label}`}
        </button>
      );
    }
    return (
      <button className="btn" onClick={() => disconnect()} title="断开钱包">
        <span className="mono">{short(address)}</span> · Disconnect
      </button>
    );
  }
  return (
    <>
      <button className="btn btn-primary" onClick={() => { reset(); setOpen(true); }}>Connect</button>
      <dialog ref={ref} className="sheet" aria-labelledby="connect-title" onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div className="sheet-body">
          <div className="sheet-head">
            <h2 id="connect-title">Connect a wallet</h2>
            <button className="x" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          </div>
          {mobile && OPEN_IN.map((w) => (
            <a key={w.id} className="row" href={w.href(location.href)}>
              <span className="ic"><img width={28} height={28} src={svgUri(WALLET_ICONS[w.id]!)} alt="" /></span>
              <span>Open in {w.name}</span>
            </a>
          ))}
          {listed.filter((c) => !mobile || c.type !== "injected").map((c) => (
            <button key={c.uid} className="row" onClick={() => connect({ connector: c, chainId: targetChainId })} disabled={isPending}>
              <span className="ic">{icon(c) ? <img width={28} height={28} src={icon(c)} alt="" /> : null}</span>
              <span>{label(c)}{isPending && variables?.connector === c ? " · opening…" : ""}</span>
            </button>
          ))}
          <p className="note" role="status">{error ? "钱包没有连接成功，可以再试一次或换一个钱包。" : ""}</p>
        </div>
      </dialog>
    </>
  );
}
