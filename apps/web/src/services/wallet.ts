import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  erc20Abi,
  http,
  type Address,
} from "viem";
import { getMagicRpcProvider, getSession } from "./auth.js";
import {
  CELO_MAINNET_CHAIN_ID,
  CELO_MAINNET_RPC_URL,
  CELO_SEPOLIA_CHAIN_ID,
  CELO_SEPOLIA_RPC_URL,
  getCeloNetworkConfig,
} from "./network.js";

export {
  CELO_MAINNET_CHAIN_ID,
  CELO_MAINNET_RPC_URL,
  CELO_SEPOLIA_CHAIN_ID,
  CELO_SEPOLIA_RPC_URL,
} from "./network.js";

export const celoSepolia = defineChain({
  id: CELO_SEPOLIA_CHAIN_ID,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: [CELO_SEPOLIA_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Celo Sepolia Explorer", url: "https://celo-sepolia.blockscout.com" },
  },
});

export const celoMainnet = defineChain({
  id: CELO_MAINNET_CHAIN_ID,
  name: "Celo Mainnet",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: [CELO_MAINNET_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "CeloScan", url: "https://celoscan.io" },
  },
});

export class WalletUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletUnavailableError";
  }
}

export class WrongNetworkError extends Error {
  readonly chainId: number;

  constructor(chainId: number, expectedName = getCeloNetworkConfig().name) {
    super(`Wallet is connected to chain ${chainId}; ${expectedName} is required`);
    this.name = "WrongNetworkError";
    this.chainId = chainId;
  }
}

export function getCeloRpcUrl(): string {
  return getCeloNetworkConfig().rpcUrl;
}

export function getConfiguredCeloChain() {
  return getCeloNetworkConfig().chainId === CELO_MAINNET_CHAIN_ID
    ? celoMainnet
    : celoSepolia;
}

export function getPublicClient() {
  return createPublicClient({
    chain: getConfiguredCeloChain(),
    transport: http(getCeloRpcUrl()),
  });
}

export function getWalletClient() {
  if (!getSession()) {
    throw new WalletUnavailableError("Sign in before using the wallet");
  }

  const provider = getMagicRpcProvider();
  if (!provider) {
    throw new WalletUnavailableError(
      "Magic wallet is not configured; set VITE_MAGIC_PUBLISHABLE_KEY",
    );
  }

  return createWalletClient({
    chain: getConfiguredCeloChain(),
    transport: custom(provider),
  });
}

export async function getWalletAddress(): Promise<Address> {
  const addresses = await getWalletClient().getAddresses();
  const address = addresses[0];
  if (!address) {
    throw new WalletUnavailableError("Magic wallet did not return an address");
  }
  return address;
}

export async function getConnectedChainId(): Promise<number> {
  return Number(await getWalletClient().getChainId());
}

export function assertCeloChainId(
  chainId: number | bigint,
  expectedChainId = getCeloNetworkConfig().chainId,
): void {
  const normalized = Number(chainId);
  if (normalized !== expectedChainId) {
    throw new WrongNetworkError(normalized, getCeloNetworkConfig().name);
  }
}

export function assertCeloSepoliaChainId(chainId: number | bigint): void {
  if (Number(chainId) !== CELO_SEPOLIA_CHAIN_ID) {
    throw new WrongNetworkError(Number(chainId), "Celo Sepolia");
  }
}

export async function ensureCeloNetwork(): Promise<void> {
  assertCeloChainId(await getConnectedChainId());
}

export async function ensureCeloSepolia(): Promise<void> {
  assertCeloSepoliaChainId(await getConnectedChainId());
}

export async function getNativeBalance(address?: Address): Promise<bigint> {
  const walletAddress = address ?? await getWalletAddress();
  return getPublicClient().getBalance({ address: walletAddress });
}

export async function getTokenBalance(
  tokenAddress: Address,
  address?: Address,
): Promise<bigint> {
  const walletAddress = address ?? await getWalletAddress();
  return getPublicClient().readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress],
  });
}
