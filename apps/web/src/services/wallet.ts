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

export const CELO_SEPOLIA_CHAIN_ID = 11142220;
export const CELO_SEPOLIA_RPC_URL = "https://forno.celo-sepolia.celo-testnet.org";

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

export class WalletUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletUnavailableError";
  }
}

export class WrongNetworkError extends Error {
  readonly chainId: number;

  constructor(chainId: number) {
    super(`Wallet is connected to chain ${chainId}; Celo Sepolia is required`);
    this.name = "WrongNetworkError";
    this.chainId = chainId;
  }
}

function envValue(name: string): string | undefined {
  const runtimeEnv = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }).env;
  return runtimeEnv?.[name];
}

export function getCeloRpcUrl(): string {
  return envValue("VITE_CELO_RPC_URL") || CELO_SEPOLIA_RPC_URL;
}

export function getPublicClient() {
  return createPublicClient({
    chain: celoSepolia,
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
    chain: celoSepolia,
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

export function assertCeloSepoliaChainId(chainId: number | bigint): void {
  const normalized = Number(chainId);
  if (normalized !== CELO_SEPOLIA_CHAIN_ID) {
    throw new WrongNetworkError(normalized);
  }
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