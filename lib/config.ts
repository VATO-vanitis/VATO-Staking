// lib/config.ts
export const CONFIG = {
  network: {
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 97),
    rpcUrl:
      process.env.NEXT_PUBLIC_RPC_URL ||
      "https://data-seed-prebsc-1-s1.binance.org:8545",
    explorer:
      process.env.NEXT_PUBLIC_EXPLORER || "https://testnet.bscscan.com",
  },
  wcProjectId: process.env.NEXT_PUBLIC_WC_ID || "",
};
