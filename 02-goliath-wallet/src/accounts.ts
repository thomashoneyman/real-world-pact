/* ACCOUNTS

This module stores the public & private key pairs for some accounts we will use
in our application.

This is extremely dangerous! In the real world, you should NEVER commit a
public/private key pair to your repository. If someone takes your private key
then they can control your account. We are storing keys in this module ONLY
for demonstration purposes.

*/

import * as Pact from "pact-lang-api";

export interface ChainwebAccount {
  address: string;
  keys: Pact.KeyPair;
}

// The faucet account owns the faucet contract and is able to upgrade it. It is
// also the account that we'll use to pay gas fees and transfer funds to users.
//
// See also 01-faucet-contract/request/keys/goliath-faucet.yaml for the actual key
// file that we generated with the Pact CLI.
export const faucetAccount: ChainwebAccount = {
  address: "goliath-faucet",
  keys: {
    publicKey: "550fdb22682e109b207a19b6b0ee0d069007d9a3eccedcb2eb7809f4f56b5ecf",
    secretKey: "2a9d9112e96e8a299091e067879c50d1cbefbd9c7fff78e2623d7e3f0cd2bf45",
  },
};

// This is the keyset that governs the faucet contract account. We'll need to
// satisfy this keyset any time we take an action on behalf of the faucet,
// which according to the "keys-all" predicate means that the private key
// corresponding with the public key in the "keys" array must have signed the
// transaction.
export const faucetKeySet: Pact.KeySet = {
  keys: [faucetAccount.keys.publicKey],
  pred: "keys-all",
};

// We also need to know the address of the wallet user account. In the real
// world you would store this in a database, but in this example app we simply
// generate new keys on every load of the application.

// You can use this as an example of how to generate new keys in your own app!
const userKeys: Pact.KeyPair = Pact.crypto.genKeyPair();

export const userAccount: ChainwebAccount = {
  address: `k:${userKeys.publicKey}`,
  keys: userKeys,
};

export const userKeySet: Pact.KeySet = {
  keys: [userAccount.keys.publicKey],
  pred: "keys-all",
};
