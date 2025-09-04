// lib/wagmi.ts
import { http } from "viem";
import { bscTestnet } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const projectId = process.env.NEXT_PUBLIC_WC_ID || "VATO-TESTNET";

export const wagmiConfig = getDefaultConfig({
  appName: "VATO Staking",
  projectId,
  chains: [bscTestnet],
  transports: {
    [bscTestnet.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL ||
        "https://data-seed-prebsc-1-s1.binance.org:8545"
    ),
  },
});
