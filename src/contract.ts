import { parseAbi } from "viem";

/** Pinned ABI of contracts/SqueekNames.sol (compiled artifact: contracts/SqueekNames.json). */
export const namesAbi = parseAbi([
  "struct Entry { uint256 tokenId; string name; address namedBy; uint64 namedAt; uint32 version; uint256 likes; uint256 weekLikes; uint256 tipped; }",
  "function currentWeek() view returns (uint256)",
  "function namedCount() view returns (uint256)",
  "function entryOf(uint256 tokenId, uint256 week) view returns (Entry)",
  "function entries(uint256 offset, uint256 limit, uint256 week) view returns (Entry[])",
  "function hasLiked(uint256 tokenId, uint32 version, address who) view returns (bool)",
  "function setName(uint256 tokenId, string name)",
  "function like(uint256 tokenId)",
  "function tip(uint256 tokenId, uint256 amount)",
  "error NotHolder(uint256 tokenId)",
  "error InvalidName()",
  "error Unnamed(uint256 tokenId)",
  "error AlreadyLiked(uint256 tokenId)",
  "error OwnLike(uint256 tokenId)",
  "error ZeroAmount()",
  "error TipFailed()",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
]);

export interface Entry {
  tokenId: bigint; name: string; namedBy: `0x${string}`; namedAt: bigint; version: number;
  likes: bigint; weekLikes: bigint; tipped: bigint;
}

/** Week index used by the contract: weeks start Monday 00:00 UTC. */
export const weekOf = (ms: number) => Math.floor((ms / 1000 + 3 * 86400) / (7 * 86400));
export const weekStart = (week: number) => new Date((week * 7 * 86400 - 3 * 86400) * 1000);

/** Short, plain reason for a failed write. */
export function reasonOf(e: unknown): string {
  const msg = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? "";
  if (/rejected|denied/i.test(msg)) return "你在钱包里取消了这次操作。";
  if (/NotHolder/.test(msg)) return "这只 Squeek 不在你的钱包里，只有持有者能起名。";
  if (/InvalidName/.test(msg)) return "名字只能用英文字母、数字、空格和连字符，最多 20 个字符。";
  if (/AlreadyLiked/.test(msg)) return "你已经给这个名字点过赞了。";
  if (/OwnLike/.test(msg)) return "不能给自己的 Squeek 点赞。";
  if (/insufficient|exceeds balance|InsufficientBalance/i.test(msg)) return "SQK 余额不够，请减少打赏数量。";
  return "交易没有成功，请检查网络后再试一次。";
}
