/*

This file implements functions and types for the 'coin-v4' fundamental contract
deployed by Kadena onto Chainweb. The coin contract provides an API for creating
accounts and transferring funds.

This file only includes functions and types from the coin module that we need
for our project, and isn't a full reproduction of the contract.

Contract source:
https://github.com/kadena-io/chainweb-node/blob/master/pact/coin-contract/v4/coin-v4.pact

*/

import Pact from "pact-lang-api";
import { mkMeta, NETWORK_ID } from "../request-utils";

export interface AccountDetailsResponse {
  account: string;
  balance: number;
  guard: Pact.KeySet;
}

interface IDetails {
  address: string;
  sender: string;
  chainId: string;
}
// The payload necessary to call the coin contract's 'details' function on the
// given chain.
export const details = (args: IDetails): Pact.LocalCmd => {
  const pactCode = `(coin.details "${args.address}")`;

  const metadata = mkMeta({
    gasLimit: 1000,
    chainId: args.chainId,
    sender: args.sender,
  });

  const transaction = { pactCode, meta: metadata };

  return transaction;
};

export interface ITransferCreate {
  sourceAccount: { address: string; keys: Pact.KeyPair };
  targetAccount: { address: string; keys: Pact.KeyPair };
  targetAccountKeySet: Pact.KeySet;
  amount: Pact.PactDecimal;
  chainId: string;
}

// The payload necessary to call the coin contract's 'transfer-create' function
// on the given chain.
export const transferCreateCmd = ({
  sourceAccount,
  targetAccount,
  targetAccountKeySet,
  amount,
  chainId,
}: ITransferCreate): Pact.ExecCmd<void> => {
  const pactCode = `(coin.transfer-create "${sourceAccount.address}" "${targetAccount.address}" (read-keyset "target-account-keyset") ${amount.decimal})`;

  const envData = { "target-account-keyset": targetAccountKeySet };

  const signature = {
    ...sourceAccount.keys,
    clist: [
      {
        name: "coin.TRANSFER",
        args: [sourceAccount.address, targetAccount.address, amount],
      },
      {
        name: "coin.GAS",
        args: [],
      },
    ],
  };

  const metadata = mkMeta({
    gasLimit: 1000,
    chainId,
    sender: sourceAccount.address,
  });

  const transaction: Pact.ExecCmd<void> = {
    networkId: NETWORK_ID,
    keyPairs: [signature],
    pactCode,
    envData,
    meta: metadata,
  };

  return transaction;
};
