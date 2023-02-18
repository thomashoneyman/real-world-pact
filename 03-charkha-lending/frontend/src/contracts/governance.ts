/*
This module supplies requests for the 'free.charkha-governance' Pact module.
*/

import Pact from "pact-lang-api";
import {
  coercePactNumber,
  coercePactObject,
  coercePactValue,
  LocalRequest,
  SendRequest,
} from "@real-world-pact/utils/pact-request";
import { AssetName } from "./controller";
import { charkhaKeyPair, sender02Address, sender02KeyPair } from "../constants";

export const STATUS_OPEN = "OPEN";
export const STATUS_REJECTED = "REJECTED";
export const STATUS_ACCEPTED = "ACCEPTED";

export interface MarketFactors {
  "base-rate": number;
  multiplier: number;
  "reserve-factor": number;
  "collateral-ratio": number;
}

export type ProposalStatus = "OPEN" | "REJECTED" | "ACCEPTED";

export type ProposalFactor = "base-rate" | "multiplier" | "reserve-factor" | "collateral-ratio";

export interface Proposal {
  author: string;
  market: AssetName;
  name: string;
  created: Date;
  status: ProposalStatus;
  proposalFactor: ProposalFactor;
  proposalValue: number;
  for: string[];
  against: string[];
}

export interface InitMarketArgs {
  market: AssetName;
  initialFactors: MarketFactors;
}

export const initMarket = ({ market, initialFactors }: InitMarketArgs): SendRequest<string> => ({
  code: {
    cmd: "free.charkha-governance.init-market",
    args: [market, JSON.stringify(initialFactors)],
  },
  sender: sender02Address,
  gasLimit: 1000,
  signers: [
    {
      ...sender02KeyPair,
      clist: [{ name: "coin.GAS", args: [] }],
    },
    {
      ...charkhaKeyPair,
      clist: [{ name: "free.charkha-governance.ADMIN", args: [] }],
    },
  ],
  transformResponse: (response) => response as string,
});

export const getMarketFactors = (market: AssetName): LocalRequest<MarketFactors> => ({
  code: { cmd: `free.charkha-governance.get-market-factors`, args: [market] },
  transformResponse: coercePactValue,
});

export type ProposalId = string;

export const getProposal = (id: ProposalId): LocalRequest<Proposal> => ({
  code: { cmd: `free.charkha-governance.get-proposal`, args: [id] },
  transformResponse: (response) => {
    const parsed = coercePactObject(response);
    return {
      name: parsed.name as string,
      author: parsed.author as string,
      status: parsed.status as ProposalStatus,
      market: parsed.market as AssetName,
      proposalValue: coercePactNumber(parsed["proposal-value"]),
      proposalFactor: parsed["proposal-factor"] as ProposalFactor,
      for: parsed.for as string[],
      against: parsed.against as string[],
      created: new Date((parsed.created as Pact.PactDate).timep),
    };
  },
});

export const getProposalIds = (): LocalRequest<ProposalId[]> => ({
  code: { cmd: `free.charkha-governance.get-proposal-ids`, args: [] },
  transformResponse: coercePactValue,
});

export interface SubmitProposalArgs {
  account: string;
  accountKeys: Pact.KeyPair;
  name: string;
  market: AssetName;
  factor: ProposalFactor;
  newValue: Pact.PactDecimal;
}

export const submitProposal = ({
  account,
  accountKeys,
  name,
  market,
  factor,
  newValue,
}: SubmitProposalArgs): SendRequest<ProposalId> => ({
  code: {
    cmd: "free.charkha-governance.submit-proposal",
    args: [account, name, market, factor, newValue],
  },
  sender: account,
  gasLimit: 1000,
  signers: {
    ...accountKeys,
    clist: [
      { name: "coin.GAS", args: [] },
      { name: "free.charkha-governance.VOTE", args: [account] },
    ],
  },
  transformResponse: (response) => response as string,
});

export interface VoteArgs {
  account: string;
  accountKeys: Pact.KeyPair;
  proposalId: ProposalId;
  choice: boolean;
}

export const vote = ({
  account,
  accountKeys,
  proposalId,
  choice,
}: VoteArgs): SendRequest<string> => ({
  code: { cmd: "free.charkha-governance.vote", args: [account, proposalId, choice] },
  sender: account,
  gasLimit: 300,
  signers: {
    ...accountKeys,
    clist: [
      { name: "coin.GAS", args: [] },
      { name: "free.charkha-governance.VOTE", args: [account] },
    ],
  },
  transformResponse: coercePactValue,
});

export const closeProposal = (proposalId: string): SendRequest<string> => ({
  code: { cmd: "free.charkha-governance.close-proposal", args: [proposalId] },
  sender: sender02Address,
  gasLimit: 1000,
  signers: {
    ...sender02KeyPair,
    clist: [{ name: "coin.GAS", args: [] }],
  },
  transformResponse: coercePactValue,
});
