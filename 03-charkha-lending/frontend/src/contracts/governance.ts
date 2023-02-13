/*
This module supplies requests for the 'free.charkha-governance' Pact module.
*/

import Pact from "pact-lang-api";
import { coercePactValue, LocalRequest, SendRequest } from "@real-world-pact/utils/pact-request";
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
  created: string; // technically a date
  status: ProposalStatus;
  "proposal-factor": ProposalFactor;
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
  transformResponse: coercePactValue,
});

export const getProposals = (): LocalRequest<ProposalId[]> => ({
  code: { cmd: `free.charkha-governance.get-proposals`, args: [] },
  transformResponse: coercePactValue,
});

export interface SubmitProposalArgs {
  account: string;
  name: string;
  market: AssetName;
  factor: ProposalFactor;
  newValue: Pact.PactDecimal;
}

export const submitProposal = ({
  account,
  name,
  market,
  factor,
  newValue,
}: SubmitProposalArgs): SendRequest<ProposalId> => ({
  code: {
    cmd: "free.charkha-governance.submit-proposal",
    args: [account, name, market, factor, newValue],
  },
  sender: sender02Address,
  gasLimit: 1000,
  signers: {
    ...sender02KeyPair,
    clist: [{ name: "coin.GAS", args: [] }],
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
  gasLimit: 400,
  signers: {
    ...sender02KeyPair,
    clist: [{ name: "coin.GAS", args: [] }],
  },
  transformResponse: coercePactValue,
});
