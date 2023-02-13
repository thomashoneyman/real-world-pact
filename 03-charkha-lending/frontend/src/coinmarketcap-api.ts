/* This module exposes requests to the CoinMarketCap API necessary to get quotes
for our various currencies. For the full details on how we arrived at these
requests, please see the Charkha development guide under the Price Oracle section.
*/

import axios from "axios";

const cmcAPI = axios.create({
  // We have to proxy requests to the CoinMarketCap API in our development
  // setup; see the vite.config.js file for the configuration.
  baseURL: "/proxy",
  headers: { "X-CMC_PRO_API_KEY": import.meta.env.VITE_CMC_API_KEY },
});

const KDA = 5647;
const KETH = 1027;
const CHRK = 5692;

export interface Prices {
  KDA: number;
  KETH: number;
  CHRK: number;
}

export const getPrices = async (): Promise<string | Prices> => {
  try {
    const { data } = await cmcAPI.get(`/v2/cryptocurrency/quotes/latest?id=${KDA},${KETH},${CHRK}`);
    const result = {
      KDA: data.data[KDA].quote.USD.price as number,
      KETH: data.data[KETH].quote.USD.price as number,
      CHRK: data.data[CHRK].quote.USD.price as number,
    };
    return result;
  } catch (error) {
    return error as string;
  }
};
