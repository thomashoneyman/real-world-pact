/*
This module supplies requests for the 'free.charkha-oracle' Pact module.
*/

import Pact from "pact-lang-api";
import { coercePactValue, LocalRequest, SendRequest } from "@real-world-pact/utils/pact-request";
import { AssetName } from "./controller";
import { charkhaKeyPair, sender02Address, sender02KeyPair } from "../constants";
import { isPactDecimal, parsePactDecimal } from "@real-world-pact/utils/pact-code";

export interface AssetPrice {
  lastUpdated: Date;
  usdPrice: number;
}

export interface RegisterAssetArgs {
  symbol: AssetName;
  price: Pact.PactDecimal;
}

export const registerAsset = (args: RegisterAssetArgs): SendRequest<string> => ({
  code: { cmd: "free.charkha-oracle.register-asset", args: [args.symbol, args.price] },
  sender: sender02Address,
  gasLimit: 500,
  signers: [
    {
      ...charkhaKeyPair,
      clist: [{ name: "free.charkha-oracle.ADMIN", args: [] }],
    },
    {
      ...sender02KeyPair,
      clist: [{ name: "coin.GAS", args: [] }],
    },
  ],
  transformResponse: (response) => response as string,
});

export interface SetPriceArgs {
  symbol: AssetName;
  price: Pact.PactDecimal;
}

export const setPrice = (args: SetPriceArgs): SendRequest<string> => ({
  code: { cmd: "free.charkha-oracle.set-price", args: [args.symbol, args.price] },
  sender: sender02Address,
  gasLimit: 500,
  signers: [
    {
      ...charkhaKeyPair,
      clist: [{ name: "free.charkha-oracle.ADMIN", args: [] }],
    },
    {
      ...sender02KeyPair,
      clist: [{ name: "coin.GAS", args: [] }],
    },
  ],
  transformResponse: (response) => response as string,
});

export const getAssets = (): LocalRequest<string[]> => ({
  code: { cmd: "free.charkha-oracle.get-assets", args: [] },
  transformResponse: coercePactValue,
});

export const getAsset = (symbol: AssetName): LocalRequest<AssetPrice> => ({
  code: { cmd: "free.charkha-oracle.get-asset", args: [symbol] },
  transformResponse: (response: Pact.PactValue) => {
    const respObj: { "last-updated": string; "usd-price": number } = coercePactValue(response);
    return {
      lastUpdated: new Date(respObj["last-updated"]),
      usdPrice: respObj["usd-price"],
    };
  },
});

export const getPrice = (symbol: AssetName): LocalRequest<number> => ({
  code: { cmd: "free.charkha-oracle.get-price", args: [symbol] },
  transformResponse: (response: Pact.PactValue) => {
    if (isPactDecimal(response)) {
      return parseFloat(response.decimal);
    } else {
      return coercePactValue(response);
    }
  },
});
