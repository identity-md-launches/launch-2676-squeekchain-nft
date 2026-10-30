import { API_BASE } from "./config";

/** Hamster state from /v1/status: running while the wheel turns, sleeping when it stops or goes stale. */
export type HamsterState = "running" | "sleeping" | "unknown";

export interface HamsterStatus {
  state: HamsterState;
  rpm: number | null;
  speedMmPerSecond: number | null;
  observedAt: string | null;
}

export interface AccountToken { tokenId: string; level: number; custody: string }
export interface Account { chainId: number; tokens: AccountToken[]; total: number }
export interface SqueekMeta { tokenId: string; name: string; image: string | null; level: number }

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { headers: { accept: "application/json" } });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${r.status}`);
  }
  return (await r.json()) as T;
}

interface StatusResponse {
  measurement?: { freshness?: string; rpmMilli?: number; speedMmPerSecond?: number; observedAt?: string; staleAfterSeconds?: number };
}

export function hamsterFrom(s: StatusResponse, now = Date.now()): HamsterStatus {
  const m = s.measurement;
  if (!m || typeof m.rpmMilli !== "number") return { state: "unknown", rpm: null, speedMmPerSecond: null, observedAt: null };
  const stale = m.observedAt ? now - Date.parse(m.observedAt) > (m.staleAfterSeconds ?? 120) * 1000 : true;
  const running = m.freshness === "online" && !stale && m.rpmMilli > 0;
  return { state: running ? "running" : "sleeping", rpm: m.rpmMilli / 1000, speedMmPerSecond: m.speedMmPerSecond ?? null, observedAt: m.observedAt ?? null };
}

export const fetchHamster = async () => hamsterFrom(await get<StatusResponse>("/status"));

interface AccountResponse {
  status: string;
  chain?: { chainId: string };
  tokens?: AccountToken[];
  tokenCounts?: Record<string, string>;
  nextCursor?: string | null;
}

/** Every Squeek an address holds or has deposited, across pages. */
export async function fetchAccount(address: string): Promise<Account> {
  const tokens: AccountToken[] = [];
  let cursor: string | null | undefined;
  let chainId = 0;
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ limit: "100" });
    if (cursor) q.set("cursor", cursor);
    const r = await get<AccountResponse>(`/accounts/${address.toLowerCase()}?${q}`);
    if (r.status !== "available") throw new Error("unavailable");
    chainId = Number(r.chain?.chainId ?? 0);
    tokens.push(...(r.tokens ?? []));
    cursor = r.nextCursor;
    if (!cursor) break;
  }
  return { chainId, tokens, total: tokens.length };
}

interface SqueekResponse {
  status: string;
  tokenId: string;
  level: number;
  metadata?: { status: string; name?: string; imageDataUri?: string };
}

const metaCache = new Map<string, Promise<SqueekMeta>>();

export function fetchSqueek(tokenId: string): Promise<SqueekMeta> {
  let p = metaCache.get(tokenId);
  if (!p) {
    p = get<SqueekResponse>(`/squeeks/${tokenId}`).then((r) => ({
      tokenId,
      name: r.metadata?.name ?? `Squeek #${tokenId}`,
      image: r.metadata?.status === "available" ? r.metadata.imageDataUri ?? null : null,
      level: r.level,
    }));
    p.catch(() => metaCache.delete(tokenId));
    metaCache.set(tokenId, p);
  }
  return p;
}
