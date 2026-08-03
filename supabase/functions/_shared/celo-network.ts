export const CELO_SEPOLIA_CHAIN_ID = 11142220;
export const CELO_MAINNET_CHAIN_ID = 42220;

export function parseCeloChainId(rawChainId?: string): number {
  const chainId = rawChainId?.trim()
    ? Number(rawChainId)
    : CELO_SEPOLIA_CHAIN_ID;

  if (chainId !== CELO_SEPOLIA_CHAIN_ID && chainId !== CELO_MAINNET_CHAIN_ID) {
    throw new Error(
      `Unsupported Celo chain ID ${String(rawChainId)}. ` +
      `Use ${CELO_SEPOLIA_CHAIN_ID} for Sepolia or ${CELO_MAINNET_CHAIN_ID} for mainnet.`,
    );
  }

  return chainId;
}

export function celoChainName(chainId: number): "Celo Sepolia" | "Celo Mainnet" {
  return chainId === CELO_MAINNET_CHAIN_ID ? "Celo Mainnet" : "Celo Sepolia";
}
