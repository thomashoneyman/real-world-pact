/*

This file implements functions and types for the 'goliath-faucet' contract that
we implemented as part of our project.

*/

import Pact, { KeyPairCapabilities } from "pact-lang-api";
import { ChainwebAccount } from "./config";
import {
  mkMeta,
  NETWORK_ID,
} from "@real-world-pact/pact-api-utils/request-utils";

// The contract is only deployed on Chain 0
export const FAUCET_CHAIN_ID = "0";

// Corresponds with constants defined in the 'goliath-faucet smart contract.
export const FAUCET_ACCOUNT = "goliath-faucet";
export const MAX_COIN_PER_REQUEST = { decimal: "20.0" };
export const MAX_COIN_PER_ACCOUNT = { decimal: "100.0" };

// This is faucet account we create and fund before deploying the smart
// contract. This account owns the faucet contract and is able to upgrade it —
// in the real world, never commit your private keys!
//
// TODO: Replace this by reading YAML from a key file.
export const goliathFaucetAccount: ChainwebAccount = {
  address: FAUCET_ACCOUNT,
  keys: {
    publicKey:
      "550fdb22682e109b207a19b6b0ee0d069007d9a3eccedcb2eb7809f4f56b5ecf",
    secretKey:
      "2a9d9112e96e8a299091e067879c50d1cbefbd9c7fff78e2623d7e3f0cd2bf45",
  },
};

// This is the keyset that governs the faucet contract account. We'll need to
// satisfy this keyset any time we take an action on behalf of the faucet,
// which according to the "keys-all" predicate means that the private key
// corresponding with the public key in the "keys" array must have signed the
// transaction.
export const goliathFaucetKeySet: Pact.KeySet = {
  keys: [goliathFaucetAccount.keys.publicKey],
  pred: "keys-all",
};

export interface IRequestFunds {
  targetAccount: string;
  targetAccountKeySet: Pact.KeySet;
  amount: Pact.PactDecimal;
  chainId: string;
}

// This helper function builds a command that can be sent to the blockchain that
// corresponds with the 'request-funds' function defined in the 'goliath-faucet'
// smart contract.
export const requestFundsCmd = ({
  targetAccount,
  targetAccountKeySet,
  amount,
  chainId,
}: IRequestFunds): Pact.ExecCmd<void> => {
  // We can determine our gas limit by referring to the gas log in our Pact REPL
  // file. We should keep this limit as low as possible, both because it
  // represents less KDA spent on gas, and because it makes it easier for our
  // transaction to make it into a block (typically, a node will stop adding
  // transactions to a block after a total gas limit of 150,000 units).
  const gasLimit = 823;

  // Next, we can format our Pact code to match a call to our contract's
  // request-funds function. This should look as it does in the REPL.
  const pactCode = `(free.goliath-faucet.request-funds "${targetAccount}" (read-keyset "target-account-keyset") ${amount.decimal})`;

  // Then, we'll put any values into the transaction data that our Pact code
  // or the contract expects to be there.
  const envData = { "target-account-keyset": targetAccountKeySet };

  // Finally, we'll put together any signatures that must be present on the
  // transaction. For the request-funds function we must sign with the faucet
  // account keys authorizing a transfer of the desired amount. The faucet is
  // also designated as the gas payer for this transaction, so we'll add that
  // capability as well.
  const goliathSignature: KeyPairCapabilities = {
    ...goliathFaucetAccount.keys,
    clist: [
      {
        name: "coin.TRANSFER",
        args: [goliathFaucetAccount.address, targetAccount, amount],
      },
      {
        name: "coin.GAS",
        args: [],
      },
    ],
  };

  const transaction = {
    networkId: NETWORK_ID,
    keyPairs: [goliathSignature],
    pactCode,
    envData,
    meta: mkMeta({
      gasLimit,
      chainId,
      sender: goliathFaucetAccount.address,
    }),
  };

  return transaction;
};

export interface ISetRequestLimit {
  account: string;
  amount: Pact.PactDecimal;
  chainId: string;
}

// This helper function builds a command that can be sent to the blockchain that
// corresponds with the 'set-request-limit' function defined in the
// 'goliath-faucet' smart contract.
export const setRequestLimit = ({
  account,
  amount,
  chainId,
}: ISetRequestLimit): Pact.ExecCmd<void> => {
  const gasLimit = 250;

  const pactCode = `(free.goliath-faucet.set-request-limit "${account}" ${amount.decimal})`;

  const goliathSignature: KeyPairCapabilities = {
    ...goliathFaucetAccount.keys,
    clist: [
      {
        name: "free.goliath-faucet.ADMIN",
        args: [],
      },
      {
        name: "coin.GAS",
        args: [],
      },
    ],
  };

  const transaction = {
    networkId: NETWORK_ID,
    keyPairs: [goliathSignature],
    pactCode,
    meta: mkMeta({
      gasLimit,
      chainId,
      sender: goliathFaucetAccount.address,
    }),
  };

  return transaction;
};

export interface ISetAccountLimit {
  account: string;
  amount: Pact.PactDecimal;
  chainId: string;
}

// This helper function builds a command that can be sent to the blockchain that
// corresponds with the 'set-request-limit' function defined in the
// 'goliath-faucet' smart contract.
export const setAccountLimit = ({
  account,
  amount,
  chainId,
}: ISetAccountLimit): Pact.ExecCmd<void> => {
  const gasLimit = 250;

  const pactCode = `(free.goliath-faucet.set-account-limit "${account}" ${amount.decimal})`;

  const goliathSignature: KeyPairCapabilities = {
    ...goliathFaucetAccount.keys,
    clist: [
      {
        name: "free.goliath-faucet.ADMIN",
        args: [],
      },
      {
        name: "coin.GAS",
        args: [],
      },
    ],
  };

  const transaction = {
    networkId: NETWORK_ID,
    keyPairs: [goliathSignature],
    pactCode,
    meta: mkMeta({
      gasLimit,
      chainId,
      sender: goliathFaucetAccount.address,
    }),
  };

  return transaction;
};

interface IGetLimits {
  account: string;
  chainId: string;
}

// This helper function builds a command that can be sent to the blockchain that
// corresponds with the 'set-request-limit' function defined in the
// 'goliath-faucet' smart contract.
export const getLimits = ({ account, chainId }: IGetLimits): Pact.LocalCmd => {
  const gasLimit = 250;

  const pactCode = `(free.goliath-faucet.get-limits "${account}")`;

  const goliathSignature: KeyPairCapabilities = {
    ...goliathFaucetAccount.keys,
    clist: [
      {
        name: "coin.GAS",
        args: [],
      },
    ],
  };

  const transaction = {
    networkId: NETWORK_ID,
    keyPairs: [goliathSignature],
    pactCode,
    meta: mkMeta({
      gasLimit,
      chainId,
      sender: goliathFaucetAccount.address,
    }),
  };

  return transaction;
};
