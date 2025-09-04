// app/wagmi.ts
"use client";

import { http } from "wagmi";
import { bsc } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const config = getDefaultConfig({
  appName: "VATO Staking",
  projectId: process.env.NEXT_PUBLIC_WC_ID!, // WalletConnect
  chains: [bsc], // 👈 ONLY BNB mainnet
  transports: {
    [bsc.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL || "https://bsc-dataseed.binance.org"
    ),
  },
  ssr: true,
});
