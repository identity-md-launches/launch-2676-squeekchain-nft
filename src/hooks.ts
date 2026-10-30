import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useConfig, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useQuery } from "@tanstack/react-query";
import { fetchAccount, fetchHamster, fetchSqueek, type HamsterStatus } from "./api";
import { DEFAULT_CHAIN_ID, NETWORKS } from "./config";
import { namesAbi, reasonOf, weekOf, type Entry } from "./contract";

/** Polls the wheel every 5 seconds; the API caches status for 1 second. */
export function useHamster(): HamsterStatus {
  const q = useQuery({ queryKey: ["hamster"], queryFn: fetchHamster, refetchInterval: 5000, retry: 1 });
  return q.data ?? { state: "unknown", rpm: null, speedMmPerSecond: null, observedAt: null };
}

export const useAccountSqueeks = (address: string | undefined) =>
  useQuery({ queryKey: ["account", address], queryFn: () => fetchAccount(address!), enabled: !!address, staleTime: 60_000, retry: 1 });

export const useSqueekMeta = (tokenId: string) =>
  useQuery({ queryKey: ["squeek", tokenId], queryFn: () => fetchSqueek(tokenId), staleTime: 300_000, retry: 1 });

/** The network every action targets: the one api.squeekchain.com serves (Sepolia today). */
export function useTarget() {
  const net = NETWORKS[DEFAULT_CHAIN_ID];
  return { net, live: !!net.names, tipsLive: !!net.names && !!net.sqk };
}

/** All named Squeeks with this week's and last week's likes, read from SqueekNames. */
export function useNameBook() {
  const { net, live } = useTarget();
  const thisWeek = weekOf(Date.now());
  const common = { address: (net.names || undefined) as `0x${string}` | undefined, abi: namesAbi, chainId: net.chainId } as const;
  const current = useReadContract({ ...common, functionName: "entries", args: [0n, 500n, BigInt(thisWeek)], query: { enabled: live, refetchInterval: 30_000 } });
  const last = useReadContract({ ...common, functionName: "entries", args: [0n, 500n, BigInt(thisWeek - 1)], query: { enabled: live, refetchInterval: 300_000 } });
  const byToken = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of (current.data ?? []) as readonly Entry[]) m.set(e.tokenId.toString(), e);
    return m;
  }, [current.data]);
  const leaders = useMemo(
    () => ([...((last.data ?? []) as readonly Entry[])].filter((e) => e.weekLikes > 0n)
      .sort((a, b) => (b.weekLikes > a.weekLikes ? 1 : b.weekLikes < a.weekLikes ? -1 : 0)).slice(0, 3)),
    [last.data],
  );
  const refetch = useCallback(() => { void current.refetch(); void last.refetch(); }, [current, last]);
  return { live, byToken, leaders, loading: live && current.isLoading, failed: live && current.isError, refetch, lastWeek: thisWeek - 1 };
}

export type TxState = { phase: "idle" } | { phase: "wallet" } | { phase: "confirming" } | { phase: "done" } | { phase: "error"; message: string };

/** One write at a time: wallet prompt, then the receipt, then a plain result. */
export function useTx() {
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<TxState>({ phase: "idle" });
  const run = useCallback(
    async (steps: Array<Parameters<typeof writeContractAsync>[0]>, onDone?: () => void) => {
      try {
        for (const s of steps) {
          setState({ phase: "wallet" });
          const hash = await writeContractAsync(s);
          setState({ phase: "confirming" });
          const r = await waitForTransactionReceipt(config, { hash, chainId: s.chainId });
          if (r.status !== "success") throw new Error("reverted");
        }
        setState({ phase: "done" });
        onDone?.();
      } catch (e) {
        setState({ phase: "error", message: reasonOf(e) });
      }
    },
    [config, writeContractAsync],
  );
  const reset = useCallback(() => setState({ phase: "idle" }), []);
  return { state, run, reset, busy: state.phase === "wallet" || state.phase === "confirming" };
}

/** True when the connected wallet can send transactions to the target network. */
export function useCanWrite() {
  const { isConnected, chainId, address } = useAccount();
  const { net } = useTarget();
  return { address, connected: isConnected, rightChain: isConnected && chainId === net.chainId };
}

/** Respect reduced motion for the banner's auto-advance. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}
