/*
This module contains overall state about users, markets, and governance. It
also contains update functions for our overall state, which are usually just
requests to various functions from our contracts.

Since markets are dynamic we really ought to fetch the market names from our
contract, but for clarity's sake I've opted to refer to markets by their
concrete names (KDA, KETH, CHRK, or cwKDA, cwKETH, cwCHRK).
*/

import * as Pact from "pact-lang-api";
import { create } from "zustand";

import { RequestStatus, SUCCESS } from "@real-world-pact/utils/pact-request";
import { AssetName, MarketToken, tokenModule } from "./contracts/controller";
import { pactAPI } from "./pact-api";
import { getPrices, Prices } from "./coinmarketcap-api";

import * as market from "./contracts/interfaces/market";
import * as fungible from "./contracts/interfaces/fungible-v2";
import * as oracle from "./contracts/oracle";
import * as governance from "./contracts/governance";
import * as controller from "./contracts/controller";

export interface AppState {
  initialized: boolean;
  setInitialized: () => void;
}

export const useAppStore = create<AppState>()((set) => ({
  initialized: false,
  setInitialized: () => set((state) => ({ ...state, initialized: true })),
}));

// The CoinMarketCap state is separate from our oracle contract because it
// really shouldn't even be a part of our application (it should be a separate
// service that administers the oracle, and our app just reads the oracle).
//
// In our application we should always read the oracle prices, not the CMC
// API responses. However, we need this so we can write to the oracle.
export interface CoinMarketCapState {
  lastAPIRefresh: number;
  error: null | string;
  lastPrices: Prices;
  getPrices: () => Promise<void>;
}

export const useCoinMarketCapStore = create<CoinMarketCapState>()((set, get) => ({
  error: null,
  lastAPIRefresh: Date.now() - 300_000,
  lastPrices: { KDA: 1.1201488, KETH: 1541.696277, CHRK: 50.287564 },
  getPrices: async () => {
    const now = Date.now();
    const diff = now - get().lastAPIRefresh;
    const minutes = Math.floor(diff / 1000 / 60);
    // We rate-limit because CMC allows at maximum ~300 calls per day.
    if (minutes > 3) {
      const newPrices = await getPrices();
      if (typeof newPrices === "string") {
        set((state) => ({ ...state, error: newPrices, lastAPIRefresh: now }));
      } else {
        set((state) => ({ ...state, error: null, lastAPIRefresh: now, lastPrices: newPrices }));
      }
    }
  },
}));

export interface OracleState {
  usdPrices: Map<AssetName, RequestStatus<number>>;
  getPrices: () => Promise<void>;
}

export const useOracleStore = create<OracleState>()((set, get) => ({
  usdPrices: new Map(),
  getPrices: async () => {
    const getPrice = (asset: AssetName) =>
      pactAPI.localWithCallback(oracle.getPrice(asset), (status) => {
        set((state) => ({
          ...state,
          usdPrices: state.usdPrices.set(asset, status),
        }));
      });
    await getPrice("KDA");
    await getPrice("KETH");
    await getPrice("CHRK");
  },
}));

export interface UserState {
  address: string;
  keys: Pact.KeyPair;
  keyset: Pact.KeySet;

  borrowingCapacity: null | RequestStatus<number>;
  getBorrowingCapacity: () => Promise<void>;

  balances: Map<AssetName, RequestStatus<number>>;
  getBalances: () => Promise<void>;

  borrows: Map<MarketToken, RequestStatus<number>>;
  getBorrows: () => Promise<void>;

  supply: Map<MarketToken, RequestStatus<number>>;
  getSupply: () => Promise<void>;
}

// We'll use sender00 as the user's account just to keep things easy.
export const useUserStore = create<UserState>()((set, get) => ({
  address: "sender00",
  keys: {
    publicKey: "368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca",
    secretKey: "251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898",
  },
  keyset: {
    keys: ["368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca"],
    pred: "keys-all",
  },

  borrowingCapacity: null,
  getBorrowingCapacity: async () => {
    const address = get().address;
    await pactAPI.sendWithCallback(controller.borrowingCapacityUSD(address), (status) => {
      set((state) => ({ ...state, borrowingCapacity: status }));
    });
  },

  balances: new Map(),
  getBalances: async () => {
    const address = get().address;
    const getBalance = (token: AssetName) =>
      pactAPI.localWithCallback(fungible.getBalance(tokenModule(token), address), (status) => {
        set((state) => ({ ...state, balances: state.balances.set(token, status) }));
      });
    await Promise.allSettled([getBalance("KDA"), getBalance("KETH"), getBalance("CHRK")]);
  },

  borrows: new Map(),
  getBorrows: async () => {
    const address = get().address;
    const getBorrow = (token: MarketToken) =>
      pactAPI.localWithCallback(market.getBorrow({ market: token, account: address }), (status) => {
        set((state) => ({ ...state, borrows: state.borrows.set(token, status) }));
      });
    await Promise.allSettled([getBorrow("cwKDA"), getBorrow("cwKETH"), getBorrow("cwCHRK")]);
  },

  supply: new Map(),
  getSupply: async () => {
    const address = get().address;
    const getSupply = (token: MarketToken) =>
      pactAPI.localWithCallback(market.getSupply({ market: token, account: address }), (status) => {
        set((state) => ({ ...state, supply: state.supply.set(token, status) }));
      });
    await Promise.allSettled([getSupply("cwKDA"), getSupply("cwKETH"), getSupply("cwCHRK")]);
  },
}));

export interface MarketState {
  markets: Map<AssetName, RequestStatus<controller.MarketState>>;
  getMarkets: () => Promise<void>;

  supplyInterestRates: Map<AssetName, RequestStatus<number>>;
  getSupplyInterestRates: () => Promise<void>;

  borrowInterestRates: Map<AssetName, RequestStatus<number>>;
  getBorrowInterestRates: () => Promise<void>;
}

export const useMarketStore = create<MarketState>()((set, get) => ({
  markets: new Map(),
  getMarkets: async () => {
    const getMarket = (asset: AssetName) =>
      pactAPI.localWithCallback(controller.getMarket(asset), (status) => {
        set((state) => ({ ...state, markets: state.markets.set(asset, status) }));
      });
    await Promise.allSettled([getMarket("KDA"), getMarket("KETH"), getMarket("CHRK")]);
  },

  supplyInterestRates: new Map(),
  getSupplyInterestRates: async () => {
    const getSupplyInterestRate = (asset: AssetName) =>
      pactAPI.localWithCallback(controller.getSupplyInterestRate(asset), (status) => {
        set((state) => ({
          ...state,
          supplyInterestRates: state.supplyInterestRates.set(asset, status),
        }));
      });
    await Promise.allSettled([
      getSupplyInterestRate("KDA"),
      getSupplyInterestRate("KETH"),
      getSupplyInterestRate("CHRK"),
    ]);
  },

  borrowInterestRates: new Map(),
  getBorrowInterestRates: async () => {
    const getBorrowInterestRate = (asset: AssetName) =>
      pactAPI.localWithCallback(controller.getBorrowInterestRate(asset), (status) => {
        set((state) => ({
          ...state,
          borrowInterestRates: state.borrowInterestRates.set(asset, status),
        }));
      });
    await Promise.allSettled([
      getBorrowInterestRate("KDA"),
      getBorrowInterestRate("KETH"),
      getBorrowInterestRate("CHRK"),
    ]);
  },
}));

export interface GovernanceState {
  proposals: Map<governance.ProposalId, RequestStatus<governance.Proposal>>;
  getProposals: () => Promise<void>;
}

export const useGovernanceStore = create<GovernanceState>()((set, get) => ({
  proposals: new Map(),
  getProposals: async () => {
    const allProposals = await pactAPI.local(governance.getProposals());
    if (allProposals.status === SUCCESS) {
      const { proposals } = get();
      const needed = allProposals.parsed.filter((proposal) => {
        const existing = proposals.get(proposal);
        // We only need to re-check open proposals or proposals that have never
        // been checked before.
        if (existing?.status === SUCCESS && existing.parsed.status === "OPEN") {
          return false;
        } else {
          return existing === undefined;
        }
      });
      const getProposal = (id: governance.ProposalId) =>
        pactAPI.localWithCallback(governance.getProposal(id), (status) => {
          set((state) => ({ ...state, proposals: state.proposals.set(id, status) }));
        });
      await Promise.allSettled(needed.map(getProposal));
    }
  },
}));

export const syncState = async () => {
  await Promise.allSettled([
    useOracleStore.getState().getPrices(),
    useUserStore.getState().getBorrows(),
    useUserStore.getState().getSupply(),
    useUserStore.getState().getBalances(),
    useMarketStore.getState().getMarkets(),
    useMarketStore.getState().getSupplyInterestRates(),
    useMarketStore.getState().getBorrowInterestRates(),
    useGovernanceStore.getState().getProposals(),
  ]);
};
