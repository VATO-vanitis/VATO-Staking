"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useSwitchChain,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { bsc, bscTestnet } from "wagmi/chains";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/* =========================================================
 * CONFIG
 * ======================================================= */
const CONFIG = {
  network: {
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 56), // 56=BNB mainnet, 97=tBNB
    rpcUrl:
      process.env.NEXT_PUBLIC_RPC_URL || "https://bsc-dataseed.binance.org",
    explorer: process.env.NEXT_PUBLIC_EXPLORER || "https://bscscan.com",
  },
  contracts: {
    staking: {
      address: (process.env.NEXT_PUBLIC_STAKING_ADDR ||
        "0xe80239e6E3af4F0E0D6cEFf33FfCCC9638fcC4B1") as `0x${string}`,
    },
    vato: {
      address: (process.env.NEXT_PUBLIC_VATO_ADDR ||
        "0xD78c339444fA0C83640A6191a6D775c321e63B78") as `0x${string}`,
    },
    nft: {
      address: (process.env.NEXT_PUBLIC_NFT_ADDR ||
        "0x80279A67b1F485f4C9de376194a38448f5a3DEBf") as `0x${string}`,
    },
  },
  // -------- Price discovery (V2 pairs) ----------
  vatoWbnbPair: (process.env.NEXT_PUBLIC_VATO_WBNB_PAIR || "") as
    | `0x${string}`
    | "",
  wbnbBusdPair: (process.env.NEXT_PUBLIC_WBNB_BUSD_PAIR || "") as
    | `0x${string}`
    | "",
  wbnb: (process.env.NEXT_PUBLIC_WBNB ||
    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c") as `0x${string}`,
  busd: (process.env.NEXT_PUBLIC_BUSD ||
    "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56") as `0x${string}`,
  // -------- Tier bonus assumptions for calculator ----------
  tierBonusBps: {
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
    6: 600,
  } as Record<number, number>,
  tiers: {
    1: { name: "vaniMAKEUP", img: "/tiers/1.png" },
    2: { name: "vaniSTYLE", img: "/tiers/2.png" },
    3: { name: "vaniDRESS", img: "/tiers/3.png" },
    4: { name: "vACCESSORY", img: "/tiers/4.png" },
    5: { name: "vaLLERY", img: "/tiers/5.png" },
    6: { name: "vANIMAL", img: "/tiers/6.png" },
  },
  copy: {
  subhead:
    "Stake $VATO for a fixed term to access utility multipliers and periodic $VATO allocations.",
  disclaimer:
    "<strong>Utility Token Notice</strong><br/>$VATO is a utility token. All benefits are loyalty- and access-based within the vanitis &amp; vasouk ecosystem and are not dividends, profit shares, or investment returns.<br/><br/>" +
    "<strong>What You Can Receive</strong>" +
    "<ul class='list-disc pl-5 space-y-1 mt-1'>" +
      "<li><b>1% Loyalty Points</b> in $VATO on every eligible vasouk marketplace purchase.</li>" +
      "<li><b>Quarterly loyalty bonuses</b> for ProVAP members funded from vasouk marketplace fees (stablecoin-denominated).</li>" +
      "<li><b>Staking multipliers &amp; time-based allocations</b> for long-term $VATO holders.</li>" +
      "<li><b>NFT boosts</b> that can amplify staking multipliers and promoter commission rates per program rules.</li>" +
    "</ul>" +
    "<div class='mt-2'><em>Funding sources:</em> vasouk marketplace fees (PRP/ProVAP pool) and designated allocations from $VATO transaction-fee mechanics.</div>" +
    "<hr class='my-3 border-gold/20'/>" +
    "<strong>Program Rules &amp; Governance</strong><br/>ProVAP membership is free. PRP calculations use your lowest $VATO balance (held + staked) in the registered wallet across the quarter compared to the total circulating supply. Eligibility, tiers, and reward levels depend on published program rules and governance approval. Schedules, allocations, and parameters may be adjusted by governance to support sustainability and compliance.<br/><br/>" +
    "<strong>Regulatory Status</strong><br/>$VATO has not yet been registered, licensed, or approved by the Dubai Virtual Assets Regulatory Authority (VARA), the EU under MiCA, or any other authority. The project is in a pre-registration phase. Participants are responsible for complying with applicable local laws.<br/><br/>" +
    "<strong>Risk Note</strong><br/>Digital tokens can be volatile; reward amounts and timing may vary and are not guaranteed. Taxes, reporting, and any regulatory obligations remain each participant’s responsibility."
},
  ipfsGateway: "https://nft.vato.international/ipfs/",
  nftMarketUrl:
    process.env.NEXT_PUBLIC_NFT_MARKET_URL || "https://vato.international/nft",
};
// -----------------Target Chain ---------------------------
const TARGET_CHAIN =
  CONFIG.network.chainId === bscTestnet.id
    ? bscTestnet
    : CONFIG.network.chainId === bsc.id
    ? bsc
    : ({ id: CONFIG.network.chainId } as any);

const TARGET_CHAIN_ID = CONFIG.network.chainId;

/* =========================================================
 * Minimal ABIs
 * ======================================================= */
const erc20Abi = [
  {
    stateMutability: "view",
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "balanceOf",
    inputs: [{ type: "address", name: "owner" }],
    outputs: [{ type: "uint256" }],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "allowance",
    inputs: [
      { type: "address", name: "owner" },
      { type: "address", name: "spender" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "approve",
    inputs: [
      { type: "address", name: "spender" },
      { type: "uint256", name: "amount" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const nftAbi = [
  {
    stateMutability: "view",
    type: "function",
    name: "hasTier",
    inputs: [
      { type: "address", name: "user" },
      { type: "uint8", name: "tier" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "balanceOf",
    inputs: [{ type: "address", name: "owner" }],
    outputs: [{ type: "uint256" }],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "tokenOfOwnerByIndex",
    inputs: [
      { type: "address", name: "owner" },
      { type: "uint256", name: "index" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "tokenURI",
    inputs: [{ type: "uint256", name: "tokenId" }],
    outputs: [{ type: "string" }],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "design",
    inputs: [{ type: "uint256", name: "" }],
    outputs: [
      { type: "string", name: "name" },
      { type: "uint8", name: "tier" },
      { type: "uint16", name: "maxEditions" },
      { type: "uint16", name: "minted" },
      { type: "uint16", name: "tierBoostBps" },
      { type: "uint256", name: "mintPriceWei" },
      { type: "bool", name: "active" },
      { type: "string", name: "baseURI" },
    ],
  },
] as const;

const stakingAbi = [
  {
    stateMutability: "view",
    type: "function",
    name: "plans",
    inputs: [{ type: "uint8", name: "" }],
    outputs: [
      { type: "uint32", name: "duration" },
      { type: "uint16", name: "apyBps" },
      { type: "uint16", name: "earlyPenaltyBps" },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "allTiersBonusBps",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "maxTotalBoostBps",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "claimPaused",
    inputs: [],
    outputs: [{ type: "bool" }],
  },

  {
    stateMutability: "view",
    type: "function",
    name: "stakesOf",
    inputs: [{ type: "address", name: "user" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { type: "uint256", name: "amount" },
          { type: "uint64", name: "start" },
          { type: "uint64", name: "lastClaim" },
          { type: "uint8", name: "plan" },
          { type: "bool", name: "active" },
        ],
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "previewMonthlyReward",
    inputs: [
      { type: "address", name: "user" },
      { type: "uint256", name: "amount" },
      { type: "uint8", name: "planIndex" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "effectiveBoostBps",
    inputs: [{ type: "address", name: "user" }],
    outputs: [{ type: "uint256" }],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "claimableMonths",
    inputs: [
      { type: "address", name: "user" },
      { type: "uint256", name: "stakeIndex" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "pendingReward",
    inputs: [
      { type: "address", name: "user" },
      { type: "uint256", name: "stakeIndex" },
    ],
    outputs: [{ type: "uint256" }],
  },

  // writes
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "stake",
    inputs: [
      { type: "uint256", name: "amount" },
      { type: "uint8", name: "planIndex" },
    ],
    outputs: [],
  },
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "claim",
    inputs: [{ type: "uint256", name: "stakeIndex" }],
    outputs: [],
  },
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "unstake",
    inputs: [{ type: "uint256", name: "stakeIndex" }],
    outputs: [],
  },
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "emergencyUnstake",
    inputs: [{ type: "uint256", name: "stakeIndex" }],
    outputs: [],
  },
] as const;

/* =========================================================
 * Helpers
 * ======================================================= */
const bpsToPct = (bps: number | bigint) => Number(bps) / 100;

// APY period rates
function periodRateFromAPY(apyPct: number, periodsPerYear: number) {
  return Math.pow(1 + apyPct / 100, 1 / periodsPerYear) - 1;
}

function tsToLocal(ts: number | bigint) {
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatDurationShort(seconds: number) {
  const s = Math.max(0, seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ipfsToGateway(uri: string, gateway = CONFIG.ipfsGateway) {
  if (!uri) return uri;
  if (uri.startsWith("ipfs://")) {
    let path = uri.slice("ipfs://".length).replace(/^ipfs\//, ""); // strip optional "ipfs/"
    // ensure single slash join
    return gateway.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
  }
  return uri;
}

/* ===== Persist & read stake tx hashes by start timestamp (per wallet) ===== */
const STAKE_TXS_KEY = (addr: string) => `stakeTxs:${addr.toLowerCase()}`;

function loadStakeTxMap(addr: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(STAKE_TXS_KEY(addr));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveStakeTx(addr: string, startTs: number | bigint, txHash: string) {
  try {
    const key = STAKE_TXS_KEY(addr);
    const map = loadStakeTxMap(addr);
    map[String(Number(startTs))] = txHash;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {}
}

/* ---------- NEW: robust IPFS helpers & JSON fallback (no UI changes) ---------- */
const IPFS_GATEWAYS = [
  CONFIG.ipfsGateway,
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

function ipfsToGatewayOnce(uri: string, gateway: string) {
  if (!uri) return uri;
  if (uri.startsWith("ipfs://")) {
    let path = uri.slice("ipfs://".length).replace(/^ipfs\//, "");
    return gateway.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
  }
  return uri;
}
function ipfsToGatewayMany(uri: string): string[] {
  if (!uri) return [];
  if (uri.startsWith("ipfs://")) {
    return IPFS_GATEWAYS.map((g) => ipfsToGatewayOnce(uri, g));
  }
  return [uri];
}
function ensureTrailingSlash(s: string) {
  return s.endsWith("/") ? s : s + "/";
}
function designJsonCandidatesFromBase(base: string, designId: number): string[] {
  if (!base) return [];
  const httpishMany = ipfsToGatewayMany(base);
  const out: string[] = [];
  for (const ustr of httpishMany) {
    try {
      const u = new URL(ustr);
      if (!u.pathname.toLowerCase().endsWith(".json")) {
        u.pathname = ensureTrailingSlash(u.pathname) + `${designId}.json`;
      }
      out.push(u.toString());
    } catch {
      out.push(ensureTrailingSlash(ustr) + `${designId}.json`);
    }
  }
  return out;
}
async function fetchJsonWithFallback(candidates: string[]): Promise<any> {
  let lastErr: any = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) {
        lastErr = new Error(`Fetch ${url} -> ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr || new Error("All metadata fetch attempts failed.");
}
/* ----------------------------------------------------------------------------- */

function formatWithCommas(value: string) {
  if (!value) return "";
  const [i, d] = value.split(".");
  const int = i ? Number(i).toLocaleString("en-US") : "";
  return d != null ? `${int}.${d}` : int;
}

// UniswapV2-style price: price(base in quote)
async function getV2PriceUSD({
  client,
  baseToken,
  vatoWbnbPair,
  wbnbBusdPair,
  wbnb,
  busd,
}: {
  client: any;
  baseToken: `0x${string}`;
  vatoWbnbPair: `0x${string}` | "";
  wbnbBusdPair: `0x${string}` | "";
  wbnb: `0x${string}`;
  busd: `0x${string}`;
}): Promise<number | null> {
  try {
    if (!client || !vatoWbnbPair || !wbnbBusdPair) return null;

    async function readPairPrice(
      pair: `0x${string}`,
      tokenA: `0x${string}`,
      tokenB: `0x${string}`
    ) {
      const [t0, t1, reserves] = await Promise.all([
        client.readContract({
          address: pair,
          abi: [
            {
              type: "function",
              name: "token0",
              stateMutability: "view",
              inputs: [],
              outputs: [{ type: "address" }],
            },
          ],
          functionName: "token0",
        }) as Promise<string>,
        client.readContract({
          address: pair,
          abi: [
            {
              type: "function",
              name: "token1",
              stateMutability: "view",
              inputs: [],
              outputs: [{ type: "address" }],
            },
          ],
          functionName: "token1",
        }) as Promise<string>,
        client.readContract({
          address: pair,
          abi: [
            {
              type: "function",
              name: "getReserves",
              stateMutability: "view",
              inputs: [],
              outputs: [
                { type: "uint112", name: "_reserve0" },
                { type: "uint112", name: "_reserve1" },
                { type: "uint32", name: "_blockTimestampLast" },
              ],
            },
          ],
          functionName: "getReserves",
        }) as Promise<[bigint, bigint, number]>,
      ]);

      const token0 = (t0 as string).toLowerCase() as `0x${string}`;
      const token1 = (t1 as string).toLowerCase() as `0x${string}`;
      const [r0, r1] = reserves;
      if (tokenA.toLowerCase() === token0 && tokenB.toLowerCase() === token1) {
        if (r0 === 0n) return null;
        return Number(r1) / Number(r0);
      }
      if (tokenA.toLowerCase() === token1 && tokenB.toLowerCase() === token0) {
        if (r1 === 0n) return null;
        return Number(r0) / Number(r1);
      }
      return null;
    }

    const vatoInWbnb = await readPairPrice(vatoWbnbPair, baseToken, wbnb);
    const wbnbInBusd = await readPairPrice(wbnbBusdPair, wbnb, busd);

    if (vatoInWbnb == null || wbnbInBusd == null) return null;
    const priceUsd = vatoInWbnb * wbnbInBusd;
    if (!isFinite(priceUsd)) return null;
    return priceUsd;
  } catch {
    return null;
  }
}

// Try different total-staked getters, stop at first that works
async function readTotalStaked(
  client: any,
  stakingAddr: `0x${string}`
): Promise<bigint | null> {
  const candidates = [
    "totalStaked",
    "totalDeposits",
    "totalTokensStaked",
    "totalStakedAmount",
  ];
  for (const fn of candidates) {
    try {
      const v = await client.readContract({
        address: stakingAddr,
        abi: [
          {
            type: "function",
            name: fn,
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "uint256" }],
          },
        ] as const,
        functionName: fn as any,
      });
      return BigInt(v as any);
    } catch {}
  }
  return null;
}

/* ===== Total claimed by user ===== */
async function readUserTotalClaimed(
  client: any,
  stakingAddr: `0x${string}`,
  user: `0x${string}`
): Promise<bigint | null> {
  const candidates = [
    { name: "totalClaimedOf", inputs: ["address"] },
    { name: "rewardsClaimed", inputs: ["address"] },
    { name: "totalClaimed", inputs: ["address"] },
    { name: "claimedOf", inputs: ["address"] },
    { name: "lifetimeClaimed", inputs: ["address"] },
    { name: "userClaimed", inputs: ["address"] },
  ] as const;

  for (const c of candidates) {
    try {
      const abi = [
        {
          type: "function",
          stateMutability: "view",
          name: c.name,
          inputs: [{ type: "address", name: "user" }],
          outputs: [{ type: "uint256" }],
        },
      ] as const;
      const v = await client.readContract({
        address: stakingAddr,
        abi,
        functionName: c.name as any,
        args: [user],
      });
      return BigInt(v as any);
    } catch {}
  }
  return null;
}

/** Extract designId & edition from tokenId = designId * 10000 + edition */
function parseDesignFromTokenId(tokenId: bigint) {
  const EDITION_BASE = 10000n;
  const designId = Number(tokenId / EDITION_BASE);
  const edition = Number(tokenId % 10000n);
  return { designId, edition };
}

/* ========= NEW: Compatible stake reader (stakesOf OR stakes(user,i)) ========= */
async function readUserStakesCompat(
  client: any,
  stakingAddr: `0x${string}`,
  user: `0x${string}`
): Promise<
  Array<{
    amount: bigint;
    start: bigint;
    lastClaim: bigint;
    plan: number;
    active: boolean;
  }>
> {
  // Try stakesOf(user)
  try {
    const arr = await client.readContract({
      address: stakingAddr,
      abi: stakingAbi,
      functionName: "stakesOf",
      args: [user],
    });
    if (Array.isArray(arr) && arr.length) {
      return (arr as any[]).map((s) => ({
        amount: BigInt(s[0]),
        start: BigInt(s[1]),
        lastClaim: BigInt(s[2]),
        plan: Number(s[3]),
        active: Boolean(s[4]),
      }));
    }
  } catch {}

  // Fallback: iterate stakes(user, i)
  const singleGetterAbi = [
    {
      stateMutability: "view",
      type: "function",
      name: "stakes",
      inputs: [
        { type: "address", name: "user" },
        { type: "uint256", name: "i" },
      ],
      outputs: [
        { type: "uint256", name: "amount" },
        { type: "uint64", name: "start" },
        { type: "uint64", name: "lastClaim" },
        { type: "uint8", name: "plan" },
        { type: "bool", name: "active" },
      ],
    },
  ] as const;

  const out: Array<{
    amount: bigint;
    start: bigint;
    lastClaim: bigint;
    plan: number;
    active: boolean;
  }> = [];
  for (let i = 0n; i < 1000n; i++) {
    try {
      const s = await client.readContract({
        address: stakingAddr,
        abi: singleGetterAbi,
        functionName: "stakes",
        args: [user, i],
      });
      out.push({
        amount: BigInt((s as any)[0]),
        start: BigInt((s as any)[1]),
        lastClaim: BigInt((s as any)[2]),
        plan: Number((s as any)[3]),
        active: Boolean((s as any)[4]),
      });
    } catch {
      break;
    }
  }
  return out;
}

/* =========================================================
 * AmountInput (commas + inline "$VATO" suffix with proper caret)
 * ======================================================= */
function normalizeRawNumeric(s: string) {
  const cleaned = s.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  const head = parts.shift()!;
  return head + "." + parts.join("").replace(/\./g, "");
}
function countDigits(str: string) {
  return (str.match(/\d/g) || []).length;
}
function indexByDigits(str: string, targetDigits: number) {
  let seen = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (/\d/.test(ch)) seen++;
    if (seen >= targetDigits) return i + 1;
  }
  return str.length;
}

type AmountInputProps = {
  valueRaw: string;
  onChangeRaw: (v: string) => void;
  symbol?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

function AmountInput({
  valueRaw,
  onChangeRaw,
  symbol = "$VATO",
  className,
  placeholder,
  disabled,
}: AmountInputProps) {
  const ref = React.useRef<HTMLInputElement>(null);
  const display =
    (valueRaw ? formatWithCommas(valueRaw) : "") + (symbol ? ` ${symbol}` : "");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const oldDisplay = input.value;
    const caret = input.selectionStart ?? oldDisplay.length;

    const digitsLeft = countDigits(oldDisplay.slice(0, caret));
    const escaped = (symbol ?? "").replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
const withoutSuffix = oldDisplay.replace(new RegExp(`\\s*${escaped}$`, "i"), "");
    const asRaw = normalizeRawNumeric(withoutSuffix.replace(/,/g, ""));

    if (asRaw !== "" && !/^\d*\.?\d*$/.test(asRaw)) {
      requestAnimationFrame(() => {
        if (!ref.current) return;
        const maxCaret =
          (ref.current.value ?? "").length - (symbol ? symbol.length + 1 : 0);
        const next = Math.min(caret, Math.max(0, maxCaret));
        ref.current.setSelectionRange(next, next);
      });
      return;
    }

    onChangeRaw(asRaw);

    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const newDisplay = el.value;
      const maxBeforeSuffix =
        newDisplay.length - (symbol ? symbol.length + 1 : 0);
      const ideal = indexByDigits(
        newDisplay.slice(0, maxBeforeSuffix),
        digitsLeft
      );
      const nextCaret = Math.min(ideal, Math.max(0, maxBeforeSuffix));
      el.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function clampCaretBeforeSuffix() {
    const el = ref.current;
    if (!el) return;
    const maxBeforeSuffix =
      el.value.length - (symbol ? symbol.length + 1 : 0);
    const caret = el.selectionStart ?? 0;
    if (caret > maxBeforeSuffix)
      el.setSelectionRange(maxBeforeSuffix, maxBeforeSuffix);
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder ?? `0.0 ${symbol}`}
      value={display}
      onChange={handleChange}
      onClick={clampCaretBeforeSuffix}
      onKeyUp={clampCaretBeforeSuffix}
      onMouseUp={clampCaretBeforeSuffix}
      onBlur={clampCaretBeforeSuffix}
      disabled={disabled}
    />
  );
}

/* =========================================================
 * Tiny Modal primitive (reuse for multiple popups)
 * ======================================================= */
function Modal({
  open,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4">
      <div
        className={`relative w-full max-w-3xl rounded-2xl border border-gold bg-black text-white ${className}`}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 h-9 w-9 rounded-full border border-gold text-gold text-xl hover:bg-gold hover:text-black"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

/* =========================================================
 * Toggle Button primitive
 * ======================================================= */
function ToggleBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-xl border px-4 py-3 text-center transition " +
        (active
          ? "border-gold bg-gold text-black shadow"
          : "border-gold bg-black text-white hover:bg-black/70")
      }
    >
      {label}
    </button>
  );
}

/* =========================================================
 * Calculator Modal (APY-based)
 * ======================================================= */
function CalculatorModal({
  open,
  onClose,
  tokenPriceUsd,
  plans,
  tierBonusBps = CONFIG.tierBonusBps,
  symbol = "$VATO",
  allTiersBonusBps = 0,
  maxTotalBoostBps = 10_000,
}: {
  open: boolean;
  onClose: () => void;
  tokenPriceUsd: number | null;
  plans: { duration: number; apyBps: number; earlyPenaltyBps: number }[];
  tierBonusBps?: Record<number, number>;
  symbol?: string;
  allTiersBonusBps?: number;
  maxTotalBoostBps?: number;
}) {
  const [amtRaw, setAmtRaw] = React.useState("");
  const [planIdx, setPlanIdx] = useState<number | null>(0);
  // Multi-select: keep a Set to toggle tiers 1..6
  const [tiersSelected, setTiersSelected] = useState<Set<number>>(new Set());

  const baseApyBps = planIdx == null ? 0 : plans[planIdx]?.apyBps ?? 0;

  // Highest selected tier (or 0 if none)
  const highestTier = tiersSelected.size
    ? Math.max(...Array.from(tiersSelected))
    : 0;

  // Bonus from highest tier only
  const highestTierBps = highestTier ? tierBonusBps[highestTier] ?? 0 : 0;

  // All-tier bonus applies ONLY if 1..6 are all selected
  const hasAllSix = [1, 2, 3, 4, 5, 6].every((n) => tiersSelected.has(n));

  const extraBpsUncapped =
    highestTierBps + (hasAllSix ? allTiersBonusBps || 0 : 0);
  const extraBps = Math.min(
    extraBpsUncapped,
    maxTotalBoostBps || extraBpsUncapped
  );

  // Convert to percent for display & math
  const totalApyPct = (baseApyBps + extraBps) / 100;

  const amount = React.useMemo(() => {
    if (!amtRaw) return 0;
    const n = Number(amtRaw);
    return Number.isFinite(n) ? n : 0;
  }, [amtRaw]);

  // Use 365-day year to match on-chain math, and 30-day "month"
  const apyFrac = totalApyPct / 100; // e.g. 0.06 for 6% APY
  const YEAR_DAYS = 365;
  const MONTH_DAYS = 30;
  const WEEK_DAYS = 7;
  const DAY_DAYS = 1;

  const yearlyTokens = amount * apyFrac;
  const monthlyTokens = amount * apyFrac * (MONTH_DAYS / YEAR_DAYS);
  const weeklyTokens = amount * apyFrac * (WEEK_DAYS / YEAR_DAYS);
  const dailyTokens = amount * apyFrac * (DAY_DAYS / YEAR_DAYS);

  const toUSD = (t: number) =>
    tokenPriceUsd != null ? t * tokenPriceUsd : null;

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-gold/80 p-4">
      <div className="relative w-full sm:max-w-xl md:max-w-2xl max-h-[95vh] h-auto flex flex-col justify-stretch overflow-y-auto rounded-2xl border border-gold bg-black p-6 text-white">
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 h-9 w-9 rounded-full border border-gold text-gold text-xl hover:bg-gold hover:text-white"
        >
          ×
        </button>

        <div className="flex flex-col items-center justify-center mb-8 text-center">
          
          <h1 className="font-display drop-shadow-dsq text-4xl md:text-5xl">
            <span className="text-gold">Staking</span>{" "}
            <span className="text-white">Calculator</span>
          </h1>
        </div>

        <div>
          <AmountInput
            valueRaw={amtRaw}
            onChangeRaw={setAmtRaw}
            symbol={symbol}
            className="mt-1 w-full rounded-xl border border-gold bg-black px-4 py-3 text-center text-xl text-white"
          />
        </div>

        <div className="mt-3">
          <div className="text-sm opacity-100 mb-2 text-center">Duration plan</div>
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => {
                const label =
                  plans[i]?.duration === 30 * 86400
                    ? "30 Days"
                    : plans[i]?.duration === 90 * 86400
                    ? "90 Days"
                    : "180 Days";
                const active = planIdx === i;
                return (
                  <ToggleBtn
                    key={i}
                    active={!!active}
                    label={
                      <div className="flex flex-col">
                        <span>{label}</span>
                        <span className="text-xs opacity-100">
                          {bpsToPct(plans[i]?.apyBps ?? 0)}% APY
                        </span>
                      </div>
                    }
                    onClick={() => setPlanIdx(active ? null : i)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-sm opacity-100 mb-2 text-center">NFT Boost</div>
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((t) => {
                const active = tiersSelected.has(t);
                const handle = () =>
                  setTiersSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(t)) next.delete(t);
                    else next.add(t);
                    return next;
                  });
                return (
                  <ToggleBtn
                    key={t}
                    active={active}
                    label={
                      <div className="flex flex-col">
                        <span>{`Tier ${t}`}</span>
                        <span className="text-xs opacity-100">
                          +{bpsToPct(tierBonusBps[t] ?? 0)}% APY Boost
                        </span>
                      </div>
                    }
                    onClick={handle}
                  />
                );
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[4, 5, 6].map((t) => {
                const active = tiersSelected.has(t);
                const handle = () =>
                  setTiersSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(t)) next.delete(t);
                    else next.add(t);
                    return next;
                  });
                return (
                  <ToggleBtn
                    key={t}
                    active={active}
                    label={
                      <div className="flex flex-col">
                        <span>{`Tier ${t}`}</span>
                        <span className="text-xs opacity-100">
                          +{bpsToPct(tierBonusBps[t] ?? 0)}% APY Boost
                        </span>
                      </div>
                    }
                    onClick={handle}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="text-xs text-center mt-2">
          {hasAllSix ? (
        <span className="opacity-100 text-white">
         +{bpsToPct(allTiersBonusBps)}% APY additional All-Tier bonus active
         </span>
        ) : (
        <span className="opacity-100">
         Select 1–6 to activate the All-Tier bonus.
        </span>
        )}
        </div>

        <div className="mt-2 text-center">
          <div className="text-2xl opacity-100">
            APY: <b>{(planIdx == null ? 0 : totalApyPct).toFixed(2)}%</b>
          </div>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-4">
          {[
            { label: "Daily", t: dailyTokens },
            { label: "Weekly", t: weeklyTokens },
            { label: "Monthly", t: monthlyTokens },
            { label: "Yearly", t: yearlyTokens },
          ].map(({ label, t }) => {
            const usd = toUSD(t);
            return (
              <div key={label} className="rounded-xl border border-gold p-4">
                <div className="text-sm opacity-70 text-center">{label}</div>
                <div className="text-lg font-semibold text-center">
                  {isFinite(t)
                    ? t.toLocaleString(undefined, { maximumFractionDigits: 3 })
                    : "—"}
                </div>
                <div className="text-lg font-semibold text-center">{symbol}</div>
                <div className="text-xs opacity-70 text-center">
                  {usd != null && isFinite(usd)
                    ? `$${usd.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}`
                    : "—"}
                </div>
          </div>
            );
          })}
        </div>
        <div className="text-xs opacity-100 mt-2 text-center">
            Period returns are pro-rata from APY (no auto-compounding).
          </div>

        <div className="mt-5 flex justify-center">
          <a
            href={CONFIG.nftMarketUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-gold bg-gold px-6 py-3 font-semibold text-black hover:brightness-95"
          >
            Buy NFT
          </a>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
 * StakeCard – one card per open stake (info boxes + buttons)
 * ======================================================= */
function StakeCard({
  s,
  idx,
  plan,
  decimals,
  symbol,
  priceUsd,
  claimPaused,
  onClaim,
  onUnstake,
  onEmergency,
  getTxForStart, // NEW
}: {
  s: any;
  idx: number;
  plan: { duration: number; apyBps: number; earlyPenaltyBps: number };
  decimals: number;
  symbol: string;
  priceUsd: number | null;
  claimPaused: boolean;
  onClaim: (i: number) => void;
  onUnstake: (i: number) => void;
  onEmergency: (i: number) => void;
  getTxForStart: (start: number | bigint) => string | undefined; // NEW
}) {
  const { address } = useAccount();
  const client = usePublicClient();
  const [months, setMonths] = useState(0);
  const [pending, setPending] = useState<bigint>(0n);

  useEffect(() => {
    if (!address || !client) return;
    (async () => {
      try {
        const [m, p] = await Promise.all([
          client.readContract({
            address: CONFIG.contracts.staking.address,
            abi: stakingAbi,
            functionName: "claimableMonths",
            args: [address, BigInt(idx)],
          }),
          client.readContract({
            address: CONFIG.contracts.staking.address,
            abi: stakingAbi,
            functionName: "pendingReward",
            args: [address, BigInt(idx)],
          }),
        ]);
        setMonths(Number(m));
        setPending(BigInt(p));
      } catch {}
    })();
  }, [address, idx, client]);

  const stakedVato = Number(formatUnits(s.amount, decimals));
  const stakedUsd = priceUsd != null ? stakedVato * priceUsd : null;

  const pendingVato = Number(formatUnits(pending, decimals));
  const pendingUsd = priceUsd != null ? pendingVato * priceUsd : null;

  const canClaim = !claimPaused && months > 0;

  // Unlock date (absolute string)
  const unlockTs = Number(s.start) + Number(plan.duration);
  const unlockDateStr = tsToLocal(unlockTs);

  // Next claim counter
  const nowSec = Math.floor(Date.now() / 1000);
  const MONTH = 30 * 86400;
  const matured = nowSec >= unlockTs;
  let nextClaimInLabel: string | null = null;
  const stakeTxHash = getTxForStart(s.start);
  if (!canClaim && nowSec < unlockTs) {
    const last = Number(s.lastClaim);
    const elapsedMonths = Math.floor((nowSec - last) / MONTH);
    const nextClaimTs = last + (elapsedMonths + 1) * MONTH;
    if (nextClaimTs > nowSec && nextClaimTs <= unlockTs) {
      nextClaimInLabel = formatDurationShort(nextClaimTs - nowSec);
    }
  }

  return (
    <div className="rounded-2xl border border-gold bg-black p-4">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div className="text-lg opacity-100">Staked $VATO</div>
        <div className="text-right">
          <div className="text-lg font-semibold">
            {stakedVato.toLocaleString(undefined, {
              maximumFractionDigits: 6,
            })}{" "}
            {symbol}
          </div>
          {stakeTxHash ? (
            <div className="text-xs opacity-100">
              <a
                className="underline mt-1"
                href={`${CONFIG.network.explorer}/tx/${stakeTxHash}`}
                target="_blank"
                rel="noreferrer"
                title={stakeTxHash}
              >
                Check Tx {stakeTxHash.slice(0, 10)}
              </a>
            </div>
          ) : null}
        </div>
      </div>

      {/* Info row */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 1) Unlock absolute date */}
        <div className="rounded-xl border border-gold p-3 text-center">
          <div className="text-sm opacity-100">Unlocks on</div>
          <div className="text-sm font-semibold">{unlockDateStr}</div>
        </div>

        {/* 2) Claimable benefit */}
        <div className="rounded-xl border border-gold p-3 text-center">
          <div className="text-sm opacity-100">Claimable benefit</div>
          <div className="text-sm font-semibold">
            {pendingVato.toLocaleString(undefined, {
              maximumFractionDigits: 6,
            })}{" "}
            {symbol}
          </div>
          <div className="text-xs opacity-70">
            {pendingUsd != null && isFinite(pendingUsd)
              ? `$${pendingUsd.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}`
              : "—"}
          </div>
        </div>
      </div>

      {/* 4) Collect button — full-size tile; adds "Next in" when nothing yet */}
      <div className="rounded-2xl border border-gold p-0 mt-3 w-full">
        <button
          className="btn-secondary w-full h-full py-3"
          disabled={!canClaim}
          onClick={() => onClaim(idx)}
          title={
            !canClaim && nextClaimInLabel
              ? `Next in: ${nextClaimInLabel}`
              : undefined
          }
        >
          {canClaim
            ? "Collect Benefit"
            : nextClaimInLabel
            ? `Next Benefit in ${nextClaimInLabel}`
            : "No Benefits to collect"}
        </button>
      </div>

      {/* Unlock / Emergency Unlock (based on maturity) */}
      <div className="mt-3">
        <button
          className="btn-primary w-full"
          onClick={() => (matured ? onUnstake(idx) : onEmergency(idx))}
          title={
            matured
              ? "Unlock stake (no fee)"
              : "Emergency unlock (early fee applies)"
          }
        >
          {matured ? "Unlock" : "Emergency Unlock"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
 * NFT Media
 * ======================================================= */
type OwnedToken = {
  id: bigint;
  designId: number;
  name?: string;
  image?: string;
  animation?: string;
  tokenUri?: string;
  metaOk?: boolean;
  metaError?: string;
};

function OwnedDesigns({
  nftAddress,
  imageSize = 180,
}: {
  nftAddress: `0x${string}`;
  imageSize?: number;
}) {
  const { address } = useAccount();
  const client = usePublicClient();
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<OwnedToken[]>([]);

  useEffect(() => {
    if (!address || !client) return;
    let cancelled = false;
    const metaCache = new Map<string, any>();

    (async () => {
      try {
        setLoading(true);

        // 1) Read balance & enumerate tokens
        const bal = (await client.readContract({
          address: nftAddress,
          abi: nftAbi,
          functionName: "balanceOf",
          args: [address],
        })) as bigint;

        const tokenIds: bigint[] = [];
        for (let i = 0n; i < bal; i++) {
          const tokenId = (await client.readContract({
            address: nftAddress,
            abi: nftAbi,
            functionName: "tokenOfOwnerByIndex",
            args: [address, i],
          })) as bigint;
          tokenIds.push(tokenId);
        }

        // 2) Precompute token -> designId (+ keep raw tokenURI as a last-resort fallback)
        const tokenWithDesign = await Promise.all(
          tokenIds.map(async (tokenId) => {
            let rawUri = "";
            try {
              rawUri = (await client.readContract({
                address: nftAddress,
                abi: nftAbi,
                functionName: "tokenURI",
                args: [tokenId],
              })) as string;
            } catch {}
            const { designId } = parseDesignFromTokenId(tokenId);
            return { tokenId, designId, rawUri };
          })
        );

        // 3) Fetch baseURI once per unique designId
        const uniqueDesignIds = Array.from(
          new Set(tokenWithDesign.map((t) => t.designId))
        );
        const baseURIsByDesign = new Map<number, string>();
        await Promise.all(
          uniqueDesignIds.map(async (id) => {
            try {
              const d = (await client.readContract({
                address: nftAddress,
                abi: nftAbi,
                functionName: "design",
                args: [BigInt(id)],
              })) as any;
              const baseURI: string = Array.isArray(d) ? d[7] : d?.baseURI ?? "";
              baseURIsByDesign.set(id, baseURI || "");
            } catch {
              baseURIsByDesign.set(id, "");
            }
          })
        );

        // Helpers to build a normalized JSON URL
        function ensureTrailingSlashLocal(s: string) {
          return s.endsWith("/") ? s : s + "/";
        }
        function buildDesignJsonUrlFromBase(base: string, designId: number) {
          if (!base) return "";
          const httpish = ipfsToGateway(base);
          try {
            const u = new URL(httpish);
            if (!u.pathname.toLowerCase().endsWith(".json")) {
              u.pathname = ensureTrailingSlashLocal(u.pathname) + `${designId}.json`;
            }
            return u.toString();
          } catch {
            return ensureTrailingSlashLocal(httpish) + `${designId}.json`;
          }
        }

        // 4) Resolve metadata & media for each token (robust fallback)
        async function resolveOne(
          tokenId: bigint,
          designId: number,
          rawUri: string
        ): Promise<OwnedToken> {
          let tokenUri = "";
          let image: string | undefined;
          let animation: string | undefined;
          let name: string | undefined;
          let metaOk = false;
          let metaError: string | undefined;

          const extractMedia = (meta: any) => {
            name = meta?.name ?? `Design #${designId}`;
            const rawImage =
              meta?.image ??
              meta?.image_url ??
              meta?.imageURI ??
              meta?.properties?.image;
            const rawAnim =
              meta?.animation_url ??
              meta?.animation ??
              meta?.properties?.animation_url;
            if (rawImage) {
              const cand = ipfsToGatewayMany(String(rawImage));
              image = cand[0] || String(rawImage);
            }
            if (rawAnim) {
              const candA = ipfsToGatewayMany(String(rawAnim));
              animation = candA[0] || String(rawAnim);
            }
            metaOk = Boolean(image || animation);
          };

          try {
            // Preferred: baseURI/<designId>.json across multiple gateways
            const base = baseURIsByDesign.get(designId) || "";
            const baseCandidates = base ? designJsonCandidatesFromBase(base, designId) : [];
            const tokenCandidates =
              rawUri && !rawUri.startsWith("data:application/json;base64,")
                ? ipfsToGatewayMany(rawUri)
                : [];

            let meta: any = null;

            if (baseCandidates.length) {
              try {
                meta = await fetchJsonWithFallback(baseCandidates);
                tokenUri = baseCandidates[0];
                metaCache.set(tokenUri, meta);
                extractMedia(meta);
              } catch (e: any) {
                metaError = `baseURI failed: ${e?.message || e}`;
              }
            }

            // Fallback: tokenURI (multi-gateway) or base64 inline
            if (!metaOk) {
              if (rawUri?.startsWith("data:application/json;base64,")) {
                try {
                  const b64 = rawUri.replace("data:application/json;base64,", "");
                  meta = JSON.parse(atob(b64));
                  tokenUri = "data:application/json;base64,[inline]";
                  metaCache.set(tokenUri, meta);
                  extractMedia(meta);
                } catch (e: any) {
                  metaError = `base64 tokenURI decode failed: ${e?.message || e}`;
                }
              } else if (tokenCandidates.length) {
                try {
                  meta = await fetchJsonWithFallback(tokenCandidates);
                  tokenUri = tokenCandidates[0];
                  metaCache.set(tokenUri, meta);
                  extractMedia(meta);
                } catch (e: any) {
                  metaError = (metaError ? metaError + " | " : "") + `tokenURI failed: ${e?.message || e}`;
                }
              }
            }

            if (!metaOk) {
              if (!metaError) metaError = "Metadata loaded but no image/animation fields were present.";
              return {
                id: tokenId,
                designId,
                tokenUri: tokenUri || rawUri || "",
                image,
                animation,
                name,
                metaOk: false,
                metaError,
              };
            }

            return {
              id: tokenId,
              designId,
              tokenUri: tokenUri || rawUri || "",
              image,
              animation,
              name,
              metaOk: true,
              metaError: undefined,
            };
          } catch (err: any) {
            return {
              id: tokenId,
              designId,
              tokenUri: tokenUri || rawUri || "",
              image,
              animation,
              name,
              metaOk: false,
              metaError: err?.message || String(err),
            };
          }
        }

        const CONC = 6;
        const out: OwnedToken[] = [];
        let idx = 0;
        async function worker() {
          while (idx < tokenWithDesign.length) {
            const cur = tokenWithDesign[idx++];
            const t = await resolveOne(cur.tokenId, cur.designId, cur.rawUri);
            out.push(t);
          }
        }
        await Promise.all(
          Array.from(
            { length: Math.min(CONC, tokenWithDesign.length) },
            worker
          )
        );

        if (!cancelled) setTokens(out);
      } catch (e) {
        console.error("OwnedDesigns error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, client, nftAddress]);

  

  const [designTiers, setDesignTiers] = useState<Record<number, number>>({});
  useEffect(() => {
  if (!client) return;
  // ✅ unique design IDs from tokens
  const ids = Array.from(new Set(tokens.map((t) => t.designId)));
  if (ids.length === 0) return;
  let cancelled = false;
  (async () => {
    try {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const d = (await client.readContract({
              address: nftAddress,
              abi: nftAbi,
              functionName: "design",
              args: [BigInt(id)],
            })) as any;
            const tier = Number(Array.isArray(d) ? d[1] : d?.tier ?? 0);
            return [id, tier] as const;
          } catch {
            return [id, 0] as const;
          }
        })
      );
      if (!cancelled) {
        const m: Record<number, number> = {};
        for (const [id, tier] of entries) m[id] = tier;
        setDesignTiers(m);
      }
    } catch {}
  })();
  return () => {
    cancelled = true;
  };
}, [client, nftAddress, tokens]);


  if (!address) return null;

  return (
    <div className="mt-1">
      <div className="mb-4 flex text-center justify-between">
        {loading ? <span className="text-sm opacity-100">Loading…</span> : null}
      </div>

      {tokens.length === 0 && !loading ? (
  <div className="text-sm opacity-100">
    Currently no NFTs in your Wallet.
  </div>
) : (
  <div className="flex flex-wrap justify-center gap-3">
    {tokens.map((t) => {
      const designId = t.designId;
      return (
        <div
          key={t.id.toString()}
          className="bg-black p-3 text-white mx-auto"
          style={{ width: imageSize }}
        >
          <div
            className="relative overflow-hidden bg-black mx-auto rounded-2xl aspect-square"
            style={{ width: imageSize, height: imageSize }}
          >
            {t.animation ? (
              <video
                src={t.animation}
                className="h-full w-full object-cover object-center"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : t.image ? (
              <img
                src={t.image}
                className="h-full w-full object-cover object-center"
                alt={t.name || `Design #${designId}`}
                loading="lazy"
              />
            ) : (
              <div className="grid h-full place-items-center text-xs opacity-60">
                No media
              </div>
            )}
          </div>

          <div className="mt-2 text-xs">
            <p className="mt-1 text-white max-w-xl">
              {/* keep your Tier/Design line exactly as before */}
              Tier {designTiers[designId] ?? Math.ceil(designId / 3)} - Design {((designId - 1) % 3) + 1}
            </p>

            {/* ✅ show exact token ID (designId * 10000 + edition) */}
            <p className="mt-1 text-white max-w-xl">
              ID {t.id.toString()}
            </p>
          </div>
        </div>
      );
    })}
  </div>
)}

    </div>
  );
}

/* =========================================================
 * Page
 * ======================================================= */
export default function Page() {
  const { address, chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const write = useWriteContract();
  const client = usePublicClient();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [planIndex, setPlanIndex] = useState(0);

  // MAIN amount input
  const [amountStr, setAmountStr] = useState("");

  const [decimals, setDecimals] = useState(18);
  const [symbol, setSymbol] = useState("VATO");
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [balance, setBalance] = useState<bigint>(0n);
  const [preview, setPreview] = useState<bigint>(0n);
  const [boostBps, setBoostBps] = useState<bigint>(0n);
  const [claimPaused, setClaimPaused] = useState(false);
  const [plans, setPlans] = useState([
    { duration: 30 * 86400, apyBps: 500, earlyPenaltyBps: 500 },
    { duration: 90 * 86400, apyBps: 600, earlyPenaltyBps: 400 },
    { duration: 180 * 86400, apyBps: 700, earlyPenaltyBps: 300 },
  ]);

  // NEW: token price & total staked
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [totalStaked, setTotalStaked] = useState<bigint | null>(null);

  const [userStakes, setUserStakes] = useState<any[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [status, setStatus] = useState<
    { kind: "info" | "error" | "success"; text: string; hash?: string } | null
  >(null);
  const [calcOpen, setCalcOpen] = useState(false);

  // NEW popups
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [apyModalOpen, setApyModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false); // "What's staking?" popup

  // NEW: total claimed (lifetime)
  const [totalClaimed, setTotalClaimed] = useState<bigint | null>(null);

  const explorerTx = (h: string) => `${CONFIG.network.explorer}/tx/${h}`;
  const onWrongChain = mounted && isConnected && chainId !== TARGET_CHAIN.id;
  const [allTiersBps, setAllTiersBps] = useState<number>(0);
  const [maxBoostBps, setMaxBoostBps] = useState<number>(10_000); // safe default 100%

  // Map: start timestamp (seconds) -> tx hash  (loaded from localStorage)
  const [stakeTxMap, setStakeTxMap] = useState<Record<string, string>>({});

  // basics
  useEffect(() => {
    if (!mounted || !client) return;
    (async () => {
      try {
        const [dec, sym] = await Promise.all([
          client.readContract({
            address: CONFIG.contracts.vato.address,
            abi: erc20Abi,
            functionName: "decimals",
          }),
          client.readContract({
            address: CONFIG.contracts.vato.address,
            abi: erc20Abi,
            functionName: "symbol",
          }),
        ]);
        setDecimals(Number(dec));
        setSymbol(String(sym));
      } catch {}
    })();
  }, [mounted, client]);

  // wallet amounts + staking flags
  useEffect(() => {
    if (!mounted || !isConnected || !address || !client) return;
    (async () => {
      try {
        const [bal, allw, paused] = await Promise.all([
          client.readContract({
            address: CONFIG.contracts.vato.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          }),
          client.readContract({
            address: CONFIG.contracts.vato.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, CONFIG.contracts.staking.address],
          }),
          client.readContract({
            address: CONFIG.contracts.staking.address,
            abi: stakingAbi,
            functionName: "claimPaused",
          }),
        ]);
        setBalance(BigInt(bal as any));
        setAllowance(BigInt(allw as any));
        setClaimPaused(Boolean(paused));
      } catch {}
    })();
  }, [mounted, isConnected, address, client, txHash]);

  // plans
  useEffect(() => {
    if (!mounted || !client) return;
    (async () => {
      try {
        const [p0, p1, p2] = await Promise.all([
          client.readContract({
            address: CONFIG.contracts.staking.address,
            abi: stakingAbi,
            functionName: "plans",
            args: [0],
          }),
          client.readContract({
            address: CONFIG.contracts.staking.address,
            abi: stakingAbi,
            functionName: "plans",
            args: [1],
          }),
          client.readContract({
            address: CONFIG.contracts.staking.address,
            abi: stakingAbi,
            functionName: "plans",
            args: [2],
          }),
        ]);
        setPlans(
          [p0, p1, p2].map((p: any) => ({
            duration: Number(p[0]),
            apyBps: Number(p[1]), // APY bps
            earlyPenaltyBps: Number(p[2]),
          }))
        );
      } catch {}
    })();
  }, [mounted, client, txHash]);

  // ===== CHANGED: user stakes + boost (compat reader) =====
  useEffect(() => {
    if (!mounted || !isConnected || !address || !client) return;
    (async () => {
      try {
        const [stakes, boost] = await Promise.all([
          readUserStakesCompat(
            client,
            CONFIG.contracts.staking.address,
            address as `0x${string}`
          ),
          client.readContract({
            address: CONFIG.contracts.staking.address,
            abi: stakingAbi,
            functionName: "effectiveBoostBps",
            args: [address],
          }),
        ]);
        setUserStakes(stakes as any[]);
        setBoostBps(BigInt(boost as any));
      } catch {
        setUserStakes([]);
        setBoostBps(0n);
      }
    })();
  }, [mounted, isConnected, address, client, txHash]);

  // NEW: price & total staked  (use CONFIG.contracts.vato.address)
useEffect(() => {
  if (!mounted || !client) return;
  (async () => {
    try {
      const pUsd = await getV2PriceUSD({
        client,
        baseToken: CONFIG.contracts.vato.address,
        vatoWbnbPair: CONFIG.vatoWbnbPair,
        wbnbBusdPair: CONFIG.wbnbBusdPair,
        wbnb: CONFIG.wbnb,
        busd: CONFIG.busd,
      });

      const tot = await readTotalStaked(client, CONFIG.contracts.staking.address);

      const allBpsRaw = await client.readContract({
        address: CONFIG.contracts.staking.address,
        abi: stakingAbi,
        functionName: "allTiersBonusBps",
      }) as number;

      const maxBpsRaw = await client.readContract({
        address: CONFIG.contracts.staking.address,
        abi: stakingAbi,
        functionName: "maxTotalBoostBps",
      }) as number;

      setPriceUsd(pUsd);
      setTotalStaked(tot);
      setAllTiersBps(Number(allBpsRaw ?? 0n));
      setMaxBoostBps(Number(maxBpsRaw ?? 0n));
    } catch {
      setPriceUsd(null);
      setTotalStaked(null);
      setAllTiersBps(0);
      setMaxBoostBps(10_000);
    }
  })();
}, [mounted, client, txHash]);

  // preview (debounced)
  useEffect(() => {
    if (!mounted || !isConnected || !address || !client) return;
    const t = setTimeout(async () => {
      try {
        const amt = amountStr ? parseUnits(amountStr, decimals) : 0n;
        if (amt === 0n) {
          setPreview(0n);
          return;
        }
        const res = await client.readContract({
          address: CONFIG.contracts.staking.address,
          abi: stakingAbi,
          functionName: "previewMonthlyReward",
          args: [address, amt, planIndex],
        });
        setPreview(BigInt(res as any));
      } catch {
        setPreview(0n);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [mounted, amountStr, planIndex, address, client, decimals]);

  // NEW: fetch total claimed for connected wallet
  useEffect(() => {
    if (!mounted || !isConnected || !address || !client) return;
    (async () => {
      try {
        const v = await readUserTotalClaimed(
          client,
          CONFIG.contracts.staking.address,
          address as `0x${string}`
        );
        setTotalClaimed(v);
      } catch {
        setTotalClaimed(null);
      }
    })();
  }, [mounted, isConnected, address, client, txHash]);

  // Load saved stake tx map whenever the wallet changes
  useEffect(() => {
    if (!address) {
      setStakeTxMap({});
      return;
    }
    try {
      setStakeTxMap(loadStakeTxMap(address));
    } catch {
      setStakeTxMap({});
    }
  }, [address, mounted]);

  const monthlyPreview = useMemo(
    () =>
      preview > 0n
        ? `${Number(formatUnits(preview, decimals)).toLocaleString(undefined, {
            maximumFractionDigits: 6,
          })} ${symbol}`
        : "—",
    [preview, decimals, symbol]
  );

  const needAllowance = useMemo(() => {
    try {
      const amt = amountStr ? parseUnits(amountStr, decimals) : 0n;
      return amt > 0n && allowance < amt;
    } catch {
      return false;
    }
  }, [amountStr, decimals, allowance]);

  // APY everywhere
  const baseApyPct = (plans[planIndex]?.apyBps ?? 0) / 100;
  const boostApyPct = Number(boostBps) / 100;
  const totalApyPct = baseApyPct + boostApyPct;

  const amountExceeds = (() => {
    try {
      const amt = amountStr ? parseUnits(amountStr, decimals) : 0n;
      return amt > balance;
    } catch {
      return false;
    }
  })();

  // Sum of user's currently active staked amounts (wei)
const userStakedActiveTotal = React.useMemo(
  () =>
    (userStakes ?? []).reduce<bigint>(
      (acc, s) => (s?.active ? acc + BigInt(s.amount) : acc),
      0n
    ),
  [userStakes]
);

  // Wallet & APY stats (INCLUSIVE of staked)
const totalHeldVatoWei = (balance ?? 0n) + (userStakedActiveTotal ?? 0n);
const walletVato = Number(formatUnits(totalHeldVatoWei, decimals));
const walletVatoFormatted = walletVato.toLocaleString(undefined, {
  maximumFractionDigits: 2,
});
const walletUsd = priceUsd != null ? walletVato * priceUsd : null;
const walletUsdFormatted =
  walletUsd != null && isFinite(walletUsd)
    ? `$${walletUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : "—";

  const totalStakedFormatted = useMemo(() => {
    if (totalStaked == null) return "—";
    try {
      return Number(formatUnits(totalStaked, decimals)).toLocaleString(
        undefined,
        { maximumFractionDigits: 2 }
      );
    } catch {
      return "—";
    }
  }, [totalStaked, decimals]);

  const priceUsdFormatted =
    priceUsd != null && isFinite(priceUsd)
      ? `$${priceUsd.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
      : "—";

  const totalValueUsdFormatted = useMemo(() => {
    if (priceUsd == null || totalStaked == null) return "—";
    try {
      const tokens = Number(formatUnits(totalStaked, decimals));
      const usd = tokens * priceUsd;
      if (!isFinite(usd)) return "—";
      return `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    } catch {
      return "—";
    }
  }, [priceUsd, totalStaked, decimals]);

  // derived formatting for total claimed
  const totalClaimedVato =
    totalClaimed != null ? Number(formatUnits(totalClaimed, decimals)) : null;
  const totalClaimedUsd =
    totalClaimedVato != null && priceUsd != null
      ? totalClaimedVato * priceUsd
      : null;
  const totalClaimedVatoFormatted =
    totalClaimedVato != null
      ? `${totalClaimedVato.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} ${symbol}`
      : "—";
  const totalClaimedUsdFormatted =
    totalClaimedUsd != null && isFinite(totalClaimedUsd)
      ? `$${totalClaimedUsd.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}`
      : "—";

  // COUNT active stakes for conditional "Collect All"
  const activeStakeCount =
    userStakes?.filter((st: any) => st?.active).length ?? 0;

  // actions
  async function doStake() {
    try {
      if (!mounted || !isConnected || !address || !client) return;
      const amt = amountStr ? parseUnits(amountStr, decimals) : 0n;
      if (amt === 0n) return;

      const code = await client.getBytecode({
        address: CONFIG.contracts.staking.address,
      });
      if (!code) {
        setStatus({
          kind: "error",
          text: "Staking contract not found on this network. Check chain & STAKING_ADDR.",
        });
        return;
      }

      const currentAllowance = (await client.readContract({
        address: CONFIG.contracts.vato.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, CONFIG.contracts.staking.address],
      })) as bigint;

      if (currentAllowance < amt) {
        setStatus({ kind: "info", text: "Approving $VATO for staking…" });
        setIsApproving(true);
        const approveHash = await write.writeContractAsync({
          address: CONFIG.contracts.vato.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [CONFIG.contracts.staking.address, amt],
        });
        await client.waitForTransactionReceipt({
          hash: approveHash as `0x${string}`,
        });
        setIsApproving(false);
        setTxHash(approveHash as string);
        setStatus({
          kind: "success",
          text: "Approval confirmed.",
          hash: approveHash as string,
        });
      }

      setStatus({ kind: "info", text: "Activating plan…" });
      const stakeHash = await write.writeContractAsync({
        address: CONFIG.contracts.staking.address,
        abi: stakingAbi,
        functionName: "stake",
        args: [amt, planIndex],
      });

      // Wait receipt & fetch block timestamp to map this stake's start -> tx
      const receipt = await client.waitForTransactionReceipt({
        hash: stakeHash as `0x${string}`,
      });

      let startTsFromBlock: number | undefined = undefined;
      try {
        const blk =
          receipt?.blockHash
            ? await client.getBlock({ blockHash: receipt.blockHash })
            : receipt?.blockNumber
            ? await client.getBlock({ blockNumber: receipt.blockNumber })
            : null;
        if (blk?.timestamp != null) {
          startTsFromBlock = Number(blk.timestamp);
        }
      } catch {}

      if (address && startTsFromBlock) {
        saveStakeTx(address, startTsFromBlock, stakeHash as string);
        setStakeTxMap(loadStakeTxMap(address)); // refresh local view
      }

      setTxHash(stakeHash as string);
      setAmountStr("");
      setPreview(0n);
      setStatus({
        kind: "success",
        text: "Activation complete.",
        hash: stakeHash as string,
      });
    } catch (e: any) {
      console.error(e);
      setStatus({
        kind: "error",
        text: e?.shortMessage || e?.message || "Transaction failed.",
      });
      setIsApproving(false);
    }
  }

  async function doClaim(idx: number) {
    if (!client) return;
    try {
      setStatus({ kind: "info", text: `Collecting month for #${idx}…` });
      const h = await write.writeContractAsync({
        address: CONFIG.contracts.staking.address,
        abi: stakingAbi,
        functionName: "claim",
        args: [BigInt(idx)],
      });
      await client.waitForTransactionReceipt({ hash: h as `0x${string}` });
      setTxHash(h as string);
      setStatus({
        kind: "success",
        text: `Collected for #${idx}.`,
        hash: h as string,
      });
    } catch (e: any) {
      console.error(e);
      setStatus({
        kind: "error",
        text: e?.shortMessage || e?.message || "Claim failed.",
      });
    }
  }

  async function doUnstake(idx: number) {
    if (!client) return;
    try {
      setStatus({ kind: "info", text: `Unlocking #${idx}…` });
      const h = await write.writeContractAsync({
        address: CONFIG.contracts.staking.address,
        abi: stakingAbi,
        functionName: "unstake",
        args: [BigInt(idx)],
      });
      await client.waitForTransactionReceipt({ hash: h as `0x${string}` });
      setTxHash(h as string);
      setStatus({
        kind: "success",
        text: `Unlocked #${idx}.`,
        hash: h as string,
      });
    } catch (e: any) {
      console.error(e);
      setStatus({
        kind: "error",
        text: e?.shortMessage || e?.message || "Unstake failed.",
      });
    }
  }

  async function doEmergencyUnstake(idx: number) {
    if (!client) return;
    try {
      setStatus({ kind: "info", text: `Emergency unlocking #${idx}…` });
      const h = await write.writeContractAsync({
        address: CONFIG.contracts.staking.address,
        abi: stakingAbi,
        functionName: "emergencyUnstake",
        args: [BigInt(idx)],
      });
      await client.waitForTransactionReceipt({ hash: h as `0x${string}` });
      setTxHash(h as string);
      setStatus({
        kind: "success",
        text: `Emergency unlocked #${idx}.`,
        hash: h as string,
      });
    } catch (e: any) {
      console.error(e);
      setStatus({
        kind: "error",
        text: e?.shortMessage || e?.message || "Emergency unlock failed.",
      });
    }
  }

  const planCards = plans.map((p, idx) => {
    const active = idx === planIndex;
    return (
      <button
        key={idx}
        onClick={() => setPlanIndex(idx)}
        className={`p-3 rounded-2xl border transition text-center ${
          active
            ? "bg-gold text-black border-gold shadow"
            : "border-gold hover:border-white"
        }`}
      >
        <div className="flex items-center justify-center">
          <div>
            <div className="text-xl font-semibold">
              {["30 days", "90 days", "180 days"][idx]}
            </div>
          </div>
        </div>
      </button>
    );
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-1 py-12">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center mb-10 text-center">
        <a href="https://vato.international">
          <img
            src="https://www.vato.international/wp-content/uploads/2024/12/2dc3a448-3694-4533-9d65-1dab6e6cc49a.png"
            alt="Vanitis Logo"
            className="h-14 w-auto mb-4 md:h-20"
          />
        </a>
        <h1 className="font-display drop-shadow-dsq text-5xl md:text-2xl xl:text-5xl">
          <span className="text-gold">Staking</span>{" "}
          <span className="text-white">Platform</span>
        </h1>
        <p className="mt-3 text-white max-w-xl">{CONFIG.copy.subhead}</p>

        {/* What's staking? button */}
        <div className="mt-4">
          <button
            className="btn-secondary"
            onClick={() => setVideoModalOpen(true)}
            aria-label="What is staking?"
            title="What is staking?"
          >
            Learn how to earn monthly benefits
          </button>
        </div>

        <div className="mt-6">{mounted ? <ConnectButton /> : null}</div>
      </div>

      {/* Network warning */}
      {onWrongChain && (
        <div className="mb-4 p-3 rounded-xl bg-black border border-gold text-sm flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2">
          {/* Show a friendly name based on target chain id.56 => BNB (mainnet), 97 => BNB Testnet (tBNB)*/}
          {(() => {
            const name =
              TARGET_CHAIN_ID === 56
                ? "BNB"
                : TARGET_CHAIN_ID === 97
                ? "BNB Testnet (tBNB)"
                : `Chain ${TARGET_CHAIN_ID}`;
            return (
              <>
                <span>
                  You are connected to a different network. Please switch to{" "}
                  <b>{name}</b>.
                </span>
                <button
                  className="btn-secondary"
                  onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
                >
                  Switch
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* 4 info boxes (with popups & full-card calculator) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-2xl border border-gold p-4">
          <div className="text-s opacity-100 text-center flex items-center justify-center gap-2">
            <span>Current Token Price</span>
            <button
              className="rounded-full border border-gold px-2 leading-none hover:bg-gold hover:text-black"
              onClick={() => setPriceModalOpen(true)}
              aria-label="Open DEX chart"
              title="Open chart"
            >
              i
            </button>
          </div>
          <div className="text-2xl font-semibold text-center">
            {priceUsdFormatted}
          </div>
        </div>

        <div className="rounded-2xl border border-gold p-4">
          <div className="text-s opacity-100 text-center">Total Staked</div>
          <div className="text-2xl font-semibold text-center">
            {totalStakedFormatted} {symbol}
          </div>
        </div>

        <div className="rounded-2xl border border-gold p-4">
          <div className="text-s opacity-100 text-center">Total Staked Value</div>
          <div className="text-2xl font-semibold text-center">
            {totalValueUsdFormatted}
          </div>
        </div>

        {/* Full-size CALCULATOR tile */}
        <div className="rounded-2xl border border-gold p-0">
          <button
            className="btn-secondary w-full h-full py-6 text-lg"
            onClick={() => setCalcOpen(true)}
          >
            CALCULATOR
          </button>
        </div>
      </div>

      {/* Status messages */}
      {status && (
        <div
          className={`mb-4 p-3 rounded-xl border text-sm ${
            status.kind === "error"
              ? "bg-red-50 border-red-200"
              : status.kind === "success"
              ? "bg-green-50 border-green-200"
              : "bg-blue-50 border-blue-200"
          }`}
          aria-live="polite"
        >
          <div className="flex items-center justify-center gap-3">
            <span>{status.text}</span>
            {status.hash && (
              <a
                className="underline"
                href={explorerTx(status.hash)}
                target="_blank"
                rel="noreferrer"
              >
                View on BscScan ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* Start Staking + Your Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Start Staking */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display text-base sm:text-3xl text-center text-white">
              START STAKING
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <AmountInput
                valueRaw={amountStr}
                onChangeRaw={setAmountStr}
                symbol={symbol}
                className="flex-1 rounded-xl border border-gold bg-black px-4 py-2 text-xl text-white"
              />
            </div>

            {/* QUICK AMOUNT CHIPS */}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[0.25, 0.5, 0.75, 1].map((p) => (
                <button
                  key={p}
                  className="btn-secondary hover:boarder-white"
                  onClick={() => {
                    const amt = Number(formatUnits(balance, decimals)) * p;
                    setAmountStr(
                      amt.toLocaleString(undefined, { useGrouping: false })
                    );
                  }}
                >
                  {Math.round(p * 100)}%
                </button>
              ))}
            </div>

            {amountExceeds && <div className="mt-3 text-s text-center text-red-500">$VATO Amount not in Wallet.</div>}

            <div className="grid grid-cols-1 sm:grid-cols-3 mt-3 gap-3">{planCards}</div>

            <div className="text-s opacity-100 text-center mt-3">
              Base multiplier {baseApyPct.toFixed(2)}% + NFT Boost {boostApyPct.toFixed(2)}% = <b>{totalApyPct.toFixed(2)}% effective staking multiplier.</b>
            </div>

            <div className="mt-3 flex items-center justify-center gap-3">
              <div className="text-l opacity-100">Monthly $VATO allocation (est.) <b>{monthlyPreview}</b></div>
            </div>

            <div className="mt-4">
              {!mounted || !isConnected ? (
                <button className="btn-primary w-full text-xl" disabled>Please Connect Wallet</button>
              ) : needAllowance ? (
                <button className="btn-primary w-full text-xl" onClick={doStake} disabled={isApproving || amountExceeds} title="Approve exact amount for staking">
                  {isApproving ? "Approving…" : "Approve & Activate"}
                </button>
              ) : (
                <button className="btn-primary w-full text-2xl" onClick={doStake} disabled={amountExceeds}>Activate</button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* YOUR BALANCE (info card) */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="font-display text-base sm:text-3xl text-center text-white">YOUR BALANCE</CardTitle>
          </CardHeader>

          <CardContent>
            {/* $VATO Balance from Wallet (Heading) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-1 text-center">
                <div className="text-s opacity-100">Your $VATO Balance</div>
              </div>

              {/* Current APY (Heading) */}
              <div className="p-1 text-center">
                <div className="text-s opacity-100 flex items-center justify-center gap-2">
                  <span>Your APY</span>
                </div>
                <div><button
                  className="rounded-full border border-gold px-2 leading-none hover:bg-gold hover:text-black"
                  onClick={() => setApyModalOpen(true)}
                  aria-label="Open APY info"
                  title="Open APY info"
                >
                  i
                </button>
                </div>
              </div>

              {/* Total extra Token received (Heading) */}
              <div className="p-1 text-center">
                <div className="text-s opacity-100">Total extra Token received</div>
              </div>
            </div>

            {/* VATO Balance from Wallet (Number) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-1 text-center">
                <div className="text-xl font-semibold mt-1">
                  {walletVatoFormatted} {symbol}
                </div>
                <div className="text-sm opacity-70">{walletUsdFormatted}</div>
              </div>

              {/* Current APY (Number) */}
              <div className="p-1 text-center">
                <div className="text-xl font-semibold mt-1">
                  {totalApyPct.toFixed(2)}%
                </div>
              </div>

              {/* Total extra Token received (Number) */}
            <div className="p-1 text-center">
                <div className="text-xl font-semibold mt-1">
                  {totalClaimedVatoFormatted}
                </div>
                <div className="text-sm opacity-70">
                  {totalClaimedUsdFormatted}
                </div>
              </div>
            </div>

            {/* Open stakes list */}
            <div className="mt-5">
              {!userStakes || userStakes.filter((s) => s.active).length === 0 ? (
                <div className="rounded-2xl">
                  <div className="p-1 text-center">
                    <div className="text-lg opacity-100 text-center">Activate your plan and track your allocations in the dashboard.</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-gold mt-2 p-2 text-white text-center max-w-xl">Connect Wallet</div>
                    <div className="rounded-2xl border border-gold mt-2 p-2 text-white text-center max-w-xl">Insert $VATO</div>
                    <div className="rounded-2xl border border-gold mt-2 p-2 text-white text-center max-w-xl">Choose Duration</div>
                    <div className="rounded-2xl border border-gold mt-2 p-2 text-white text-center max-w-xl">Approve & Activate</div>
                  </div>
                </div>

              ) : (
                <div className="grid gap-4">
                  {userStakes?.map((s, idx) => {
                    if (!s.active) return null;
                    const plan = plans[s.plan] || plans[0];
                    return (
                      <StakeCard
                        key={idx}
                        s={s}
                        idx={idx}
                        plan={plan}
                        decimals={decimals}
                        symbol={symbol}
                        priceUsd={priceUsd}
                        claimPaused={claimPaused}
                        onClaim={doClaim}
                        onUnstake={doUnstake}
                        onEmergency={doEmergencyUnstake}
                        getTxForStart={(start) => stakeTxMap[String(Number(start))]} // NEW
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* COLLECT ALL — only if more than one stake is active */}
            {activeStakeCount > 1 && (
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <button
                  className="btn-secondary w-full sm:w-auto"
                  onClick={async () => {
                    if (!client || !address) return;
                    setStatus({ kind: "info", text: "Collecting all available months..." });
                    for (let i = 0; i < userStakes.length; i++) {
                      const st = userStakes[i];
                      if (!st?.active) continue;
                      try {
                        const m = await client.readContract({
                          address: CONFIG.contracts.staking.address,
                          abi: stakingAbi,
                          functionName: "claimableMonths",
                          args: [address, BigInt(i)],
                        });
                        if (Number(m) > 0) {
                          await doClaim(i);
                        }
                      } catch {}
                    }
                  }}
                  title="Claims any stake that has a full month available"
                >
                  Collect all Benefits
                </button>
              </div>
            )}

            <div className="mt-3 text-xs text-center opacity-100">
              Early unlock fee applies before the plan ends.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Boosts */}
      <Card className="rounded-2xl mt-3">
        <CardHeader className="text-center">
          <CardTitle className="font-display pb-0 text-base sm:text-3xl text-center text-white">YOUR NFT BOOST +{bpsToPct(boostBps)}%</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pt-0 text-center">
          <OwnedDesigns nftAddress={CONFIG.contracts.nft.address} imageSize={180} />
          <div className="mt-2 mb-2 text-xs text-center opacity-100">
            <a href={`${CONFIG.network.explorer}/address/${CONFIG.contracts.nft.address}`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-gold">
              View NFT Contract on BscScan ↗
            </a>
          </div>

          {/* Marketplace button at the bottom */}
          <div className="mt-1">
            <a
              href={CONFIG.nftMarketUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary w-full inline-block sm:text-lg text-center"
            >
              Visit the vaNFT Marketplace
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Footers & Modals */}
      <div
  className="mt-8 mx-auto max-w-3xl rounded-2xl border border-gold/60 bg-black/50 p-5 text-left text-xs leading-relaxed"
  aria-label="Program Disclaimer"
  dangerouslySetInnerHTML={{ __html: CONFIG.copy.disclaimer }}
/>

      {/* DEXTOOLS POPUP */}
      <Modal open={priceModalOpen} onClose={() => setPriceModalOpen(false)} className="p-4">
        <div className="p-4">
          <h3 className="text-xl font-semibold text-center mb-2">DEX Chart</h3>
          <p className="text-sm opacity-100 text-center mb-3">
            Price derived from V2 pair reserves ($VATO/WBNB and WBNB/BUSD). Thin liquidity may cause higher volatility.
          </p>
          <div className="w-full overflow-hidden rounded-xl border border-gold">
            <iframe
              id="dextools-widget"
              title="DEXTools Trading Chart"
              width="100%"
              height="420"
              src="https://www.dextools.io/widget-chart/en/bnb/pe-light/0x01e183d12cebb26ea152bde29a63785aacd1c4b3?theme=dark&chartType=1&chartResolution=1D&drawingToolbars=false&tvPlatformColor=2B2B2A&tvPaneColor=2B2B2A&headerColor=2B2B2A&chartInUsd=true"
            />
          </div>
        </div>
      </Modal>

      {/* APY INFO POPUP */}
      <Modal open={apyModalOpen} onClose={() => setApyModalOpen(false)} className="p-4">
        <div className="p-4">
          <h3 className="text-xl font-semibold text-center mb-2">APY Info</h3>
          <p className="text-sm opacity-80 text-center mb-3">
            APY is based on certain requirements. Check the list below to understand how we provide our bonuses.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-gold/50">
                  <th className="py-2 pr-3">Tier</th>
                  <th className="py-2 pr-3">30 Days</th>
                  <th className="py-2 pr-3">90 Days</th>
                  <th className="py-2">180 Days</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["No NFT", "5%", "6%", "7%"],
                  ["Tier 1", "6%", "7%", "8%"],
                  ["Tier 2", "7%", "8%", "9%"],
                  ["Tier 3", "8%", "9%", "10%"],
                  ["Tier 4", "9%", "10%", "11%"],
                  ["Tier 5", "10%", "11%", "12%"],
                  ["Tier 6", "11%", "12%", "13%"],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-gold/10">
                    {row.map((cell, j) => (
                      <td key={j} className="py-2 pr-3">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6">
            <a
              href={CONFIG.nftMarketUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary w-full inline-block text-center"
            >
              Go to NFT Marketplace
            </a>
          </div>
        </div>
      </Modal>

      {/* What's Staking? POPUP (YouTube) */}
      <Modal open={videoModalOpen} onClose={() => setVideoModalOpen(false)} className="p-4">
        <div className="p-4">
          <h3 className="text-xl font-semibold mb-2 text-center">What’s staking?</h3>
          <p className="text-sm opacity-100 text-center mb-3">
            Quick introduction video to how staking works and what to expect.
          </p>
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-gold">
            <iframe
              title="What is Staking?"
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/GhpIprKFHoU?si=FrEie0_s-Vn-q6ti"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </Modal>

      <CalculatorModal
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        tokenPriceUsd={priceUsd}
        plans={plans}
        symbol={symbol}
        allTiersBonusBps={allTiersBps}
        maxTotalBoostBps={maxBoostBps}
      />
    </div>
  );
}
