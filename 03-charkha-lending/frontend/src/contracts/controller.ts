/*
This module supplies requests for the 'free.charkha-controller' Pact module.
*/

import Pact from "pact-lang-api";
import { coercePactValue, LocalRequest, SendRequest } from "@real-world-pact/utils/pact-request";
import { charkhaAddress, charkhaKeyPair, sender02Address, sender02KeyPair } from "../constants";
import { formatPactCode, formatPactNumericResponse } from "@real-world-pact/utils/pact-code";

export const BLOCKS_PER_YEAR = 1051920;

export type AssetName = "KDA" | "KETH" | "CHRK";

export const tokenModule = (asset: AssetName): string => {
  if (asset === "KDA") return "coin";
  if (asset === "KETH") return "free.KETH";
  if (asset === "CHRK") return "free.CHRK";
  throw new Error(`Unsupported asset: ${asset}`);
};

export const marketModule = (asset: AssetName): string => {
  return `free.${assetToToken(asset)}`;
};

export type MarketToken = "cwKDA" | "cwKETH" | "cwCHRK";

export const assetToToken = (asset: AssetName): MarketToken => {
  if (asset === "KDA") return "cwKDA";
  if (asset === "KETH") return "cwKETH";
  if (asset === "CHRK") return "cwCHRK";
  throw "Unsupported market.";
};

export interface MarketState {
  totalBorrows: number;
  totalSupply: number;
  totalReserves: number;
  lastUpdated: number;
  interestRateIndex: number;
  exchangeRate: number;
  rewardShare: number;
  // There are also the two references, but we don't have a way to use them in
  // our TypeScript code so they're omitted.
}

export const registerMarket = (asset: AssetName): SendRequest<string> => ({
  code: {
    cmd: "free.charkha-controller.register-market",
    args: [asset, { ref: tokenModule(asset) }, { ref: marketModule(asset) }],
  },
  gasLimit: 1600,
  sender: sender02Address,
  signers: [
    {
      ...sender02KeyPair,
      clist: [{ name: "coin.GAS", args: [] }],
    },
    {
      ...charkhaKeyPair,
      clist: [{ name: "free.charkha-controller.ADMIN", args: [] }],
    },
  ],
  transformResponse: coercePactValue,
});

export const getMarketCount = (): LocalRequest<number> => ({
  code: { cmd: "free.charkha-controller.get-market-count", args: [] },
  transformResponse: (response) => formatPactNumericResponse(coercePactValue(response)),
});

export const getMarketNames = (): LocalRequest<string[]> => ({
  code: { cmd: "free.charkha-controller.get-market-names", args: [] },
  transformResponse: coercePactValue,
});

export const getMarket = (asset: AssetName): LocalRequest<MarketState> => ({
  code: { cmd: "free.charkha-controller.get-market", args: [asset] },
  transformResponse: (response) => {
    interface PactMarketState {
      "total-borrows": Pact.PactDecimal | Pact.PactInt | number;
      "total-supply": Pact.PactDecimal | Pact.PactInt | number;
      "total-reserves": Pact.PactDecimal | number;
      "last-updated": number;
      "interest-rate-index": number;
      "exchange-rate": number;
      "reward-share": number;
    }
    const parsed: PactMarketState = coercePactValue(response);
    return {
      totalBorrows: formatPactNumericResponse(parsed["total-borrows"]),
      totalSupply: formatPactNumericResponse(parsed["total-supply"]),
      totalReserves: formatPactNumericResponse(parsed["total-reserves"]),
      lastUpdated: formatPactNumericResponse(parsed["last-updated"]),
      interestRateIndex: formatPactNumericResponse(parsed["interest-rate-index"]),
      exchangeRate: formatPactNumericResponse(parsed["exchange-rate"]),
      rewardShare: formatPactNumericResponse(parsed["reward-share"]),
    };
  },
});

export const getInterestRateIndex = (asset: AssetName): LocalRequest<number> => ({
  code: { cmd: "free.charkha-controller.get-interest-rate-index", args: [asset] },
  transformResponse: (response) => formatPactNumericResponse(coercePactValue(response)),
});

export const getExchangeRate = (asset: AssetName): LocalRequest<number> => ({
  code: { cmd: "free.charkha-controller.get-exchange-rate", args: [asset] },
  transformResponse: (response) => formatPactNumericResponse(coercePactValue(response)),
});

interface BorrowingCapacityArgs {
  account: string;
  asset: AssetName;
}

export const borrowingCapacity = (args: BorrowingCapacityArgs): SendRequest<number> => ({
  code: { cmd: "free.charkha-controller.borrowing-capacity", args: [args.account, args.asset] },
  gasLimit: 900,
  sender: sender02Address,
  signers: {
    ...sender02KeyPair,
    clist: [{ name: "coin.GAS", args: [] }],
  },
  transformResponse: (response) => formatPactNumericResponse(coercePactValue(response)),
});

export const borrowingCapacityUSD = (account: string): SendRequest<number> => ({
  code: { cmd: "free.charkha-controller.borrowing-capacity-usd", args: [account] },
  gasLimit: 900,
  sender: sender02Address,
  signers: {
    ...sender02KeyPair,
    clist: [{ name: "coin.GAS", args: [] }],
  },
  transformResponse: (response) => formatPactNumericResponse(coercePactValue(response)),
});

export interface LiquidationEligibleArgs {
  account: string;
  market: AssetName;
}

export const liquidationEligible = (args: LiquidationEligibleArgs): SendRequest<number> => ({
  code: { cmd: "free.charkha-controller.liquidation-eligible", args: [args.account, args.market] },
  gasLimit: 1000,
  sender: sender02Address,
  signers: {
    ...sender02KeyPair,
    clist: [{ name: "coin.GAS", args: [] }],
  },
  transformResponse: coercePactValue,
});

export const getUtilization = (market: AssetName): LocalRequest<number> => ({
  code: { cmd: "free.charkha-controller.get-utilization", args: [market] },
  transformResponse: (response) => formatPactNumericResponse(coercePactValue(response)),
});

export const getBorrowInterestRate = (market: AssetName): LocalRequest<number> => ({
  code: { cmd: "free.charkha-controller.get-borrow-interest-rate", args: [market] },
  transformResponse: (response) => formatPactNumericResponse(coercePactValue(response)),
});

export const getSupplyInterestRate = (market: AssetName): LocalRequest<number> => ({
  code: { cmd: "free.charkha-controller.get-supply-interest-rate", args: [market] },
  transformResponse: (response) => formatPactNumericResponse(coercePactValue(response)),
});

export interface SupplyArgs {
  account: string;
  accountKeys: Pact.KeyPair;
  market: AssetName;
  amount: Pact.PactDecimal;
}

export const supply = ({
  account,
  accountKeys,
  market,
  amount,
}: SupplyArgs): SendRequest<string> => ({
  code: { cmd: "free.charkha-controller.supply", args: [account, market, amount] },
  gasLimit: 7000,
  sender: account,
  signers: {
    ...accountKeys,
    clist: [
      { name: "coin.GAS", args: [] },
      { name: `${tokenModule(market)}.TRANSFER`, args: [account, charkhaAddress, amount] },
    ],
  },
  transformResponse: coercePactValue,
});

export interface RedeemArgs {
  account: string;
  accountKeys: Pact.KeyPair;
  market: AssetName;
  tokens: Pact.PactDecimal;
}

export const redeem = ({
  account,
  accountKeys,
  market,
  tokens,
}: RedeemArgs): SendRequest<string> => ({
  code: { cmd: "free.charkha-controller.redeem", args: [account, market, tokens] },
  gasLimit: 7000,
  sender: account,
  signers: {
    ...accountKeys,
    clist: [{ name: "coin.GAS", args: [] }],
  },
  transformResponse: coercePactValue,
});

export interface BorrowArgs {
  account: string;
  accountKeys: Pact.KeyPair;
  accountKeySet: Pact.KeySet;
  market: AssetName;
  tokens: Pact.PactDecimal;
}

export const borrow = ({
  account,
  accountKeys,
  accountKeySet,
  market,
  tokens,
}: BorrowArgs): SendRequest<string> => ({
  code: {
    cmd: "free.charkha-controller.borrow",
    args: [account, { cmd: "read-keyset", args: ["user-keyset"] }, market, tokens],
  },
  data: { "user-keyset": accountKeySet },
  gasLimit: 8000,
  sender: account,
  signers: {
    ...accountKeys,
    clist: [{ name: "coin.GAS", args: [] }],
  },
  transformResponse: coercePactValue,
});

export interface RepayArgs {
  account: string;
  accountKeys: Pact.KeyPair;
  market: AssetName;
  amount: Pact.PactDecimal;
}

export const repay = ({
  account,
  accountKeys,
  market,
  amount,
}: RepayArgs): SendRequest<string> => ({
  code: { cmd: "free.charkha-controller.repay", args: [account, market, amount] },
  gasLimit: 3500,
  sender: account,
  signers: {
    ...accountKeys,
    clist: [{ name: "coin.GAS", args: [] }],
  },
  transformResponse: coercePactValue,
});

export interface LiquidateArgs {
  liquidator: string;
  liquidatorKeys: Pact.KeyPair;
  account: string;
  market: AssetName;
  amount: Pact.PactDecimal;
}

export const liquidate = ({
  liquidator,
  liquidatorKeys,
  account,
  market,
  amount,
}: LiquidateArgs): SendRequest<string> => ({
  code: { cmd: "free.charkha-controller.liquidate", args: [liquidator, account, market, amount] },
  gasLimit: 3500,
  sender: liquidator,
  signers: {
    ...liquidatorKeys,
    clist: [
      { name: "coin.GAS", args: [] },
      { name: `${tokenModule(market)}.TRANSFER`, args: [liquidator, charkhaAddress, amount] },
    ],
  },
  transformResponse: coercePactValue,
});
