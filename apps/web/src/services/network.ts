import {
  CELO_MAINNET_CHAIN_ID,
  CELO_SEPOLIA_CHAIN_ID,
} from "@trickshot/shared";

export { CELO_MAINNET_CHAIN_ID, CELO_SEPOLIA_CHAIN_ID } from "@trickshot/shared";

export const CELO_SEPOLIA_RPC_URL = "https://forno.celo-sepolia.celo-testnet.org";
export const CELO_MAINNET_RPC_URL = "https://forno.celo.org";

export type CeloNetworkConfig = {
  chainId: typeof CELO_SEPOLIA_CHAIN_ID | typeof CELO_MAINNET_CHAIN_ID;
  name: "Celo Sepolia" | "Celo Mainnet";
  rpcUrl: string;
  explorerUrl: string;
};

function envValue(name: string): string | undefined {
  const runtimeEnv = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }).env;
  return runtimeEnv?.[name];
}

export function resolveCeloNetworkConfig(
  rawChainId?: string,
  rawRpcUrl?: string,
): CeloNetworkConfig {
  const chainId = rawChainId?.trim() ? Number(rawChainId) : CELO_SEPOLIA_CHAIN_ID;

  if (chainId === CELO_MAINNET_CHAIN_ID) {
    return {
      chainId: CELO_MAINNET_CHAIN_ID,
      name: "Celo Mainnet",
      rpcUrl: rawRpcUrl?.trim() || CELO_MAINNET_RPC_URL,
      explorerUrl: "https://celoscan.io",
    };
  }

  if (chainId === CELO_SEPOLIA_CHAIN_ID) {
    return {
      chainId: CELO_SEPOLIA_CHAIN_ID,
      name: "Celo Sepolia",
      rpcUrl: rawRpcUrl?.trim() || CELO_SEPOLIA_RPC_URL,
      explorerUrl: "https://celo-sepolia.blockscout.com",
    };
  }

  throw new Error(
    `Unsupported Celo chain ID ${String(rawChainId)}. ` +
    `Use ${CELO_SEPOLIA_CHAIN_ID} for Sepolia or ${CELO_MAINNET_CHAIN_ID} for mainnet.`,
  );
}

export function getCeloNetworkConfig(): CeloNetworkConfig {
  return resolveCeloNetworkConfig(
    envValue("VITE_CELO_CHAIN_ID"),
    envValue("VITE_CELO_RPC_URL"),
  );
}
