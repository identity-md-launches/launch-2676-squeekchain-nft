import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { mainnet, sepolia } from "viem/chains";
import type { Address } from "viem";

/**
 * The site's single configuration file: chains, public RPCs, addresses and wallet connectors.
 *
 * SqueekChain is a hamster-powered proof-of-work chain that settles on Ethereum. Its public
 * deployment today is on Sepolia (chain 11155111); the launch deployment on Ethereum mainnet does
 * not exist yet. Every address below that is "" is an owner-set value listed under "After launch"
 * in README.md. While a value is unset, the feature it governs stays off and says so.
 */

export const SITE_NAME = "Squeek 起名屋";
export const SITE_DESCRIPTION = "给你的 Squeek 仓鼠 NFT 起个英文名，存在链上，收集点赞和 SQK 打赏。";
export const SITE_URL = typeof location !== "undefined" ? location.origin + location.pathname : "";
export const SITE_ICON_URL = SITE_URL ? new URL("favicon.svg", SITE_URL).href : "";

/** Public read API named by the brief: hamster status, account Squeeks and Squeek images. */
export const API_BASE = "https://api.squeekchain.com/v1";

export type ChainId = typeof sepolia.id | typeof mainnet.id;

export interface NetworkSettings {
  chainId: ChainId;
  label: string;
  rpcUrl: string;
  explorer: string;
  /** SqueekNames contract (contracts/SqueekNames.sol). "" until the owner deploys it. */
  names: Address | "";
  /** SQK ERC-20 used for tips. */
  sqk: Address | "";
  /** Whether api.squeekchain.com serves this network's Squeeks. */
  apiTarget: string;
}

export const NETWORKS: Record<ChainId, NetworkSettings> = {
  [sepolia.id]: {
    chainId: sepolia.id,
    label: "Sepolia",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    explorer: "https://sepolia.etherscan.io",
    // AFTER LAUNCH: set to the deployed SqueekNames address on Sepolia.
    names: "",
    // SQK as reported by api.squeekchain.com/v1/economy/state (asset.address), release stream-game-sepolia-test-20261026-01.
    sqk: "0x5501e1fa81be1c3f49225fa7668da0245d07db60",
    apiTarget: "sepolia",
  },
  [mainnet.id]: {
    chainId: mainnet.id,
    label: "SqueekChain 主网",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    explorer: "https://etherscan.io",
    // AFTER LAUNCH: SqueekChain has no mainnet deployment yet. Set both once it launches.
    names: "",
    sqk: "",
    apiTarget: "mainnet",
  },
};

export const DEFAULT_CHAIN_ID: ChainId = sepolia.id;

export const walletConnectProjectId = ""; // only when the brief supplies one

export const config = createConfig({
  chains: [sepolia, mainnet],
  // EIP-6963 discovery lists every installed extension under its own name
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
    ...(walletConnectProjectId
      ? [walletConnect({ projectId: walletConnectProjectId, showQrModal: true,
          metadata: { name: SITE_NAME, description: SITE_DESCRIPTION, url: SITE_URL, icons: [SITE_ICON_URL] } })]
      : []),
    coinbaseWallet({ appName: SITE_NAME }),
  ],
  transports: {
    [sepolia.id]: http(NETWORKS[sepolia.id].rpcUrl),
    [mainnet.id]: http(NETWORKS[mainnet.id].rpcUrl),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
