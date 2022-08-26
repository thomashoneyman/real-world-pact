import * as Pact from "pact-lang-api";

/* The accounts below exist on our target blockchain (devnet). You can see all
available accounts in the Chainweb node used for devnet here:
https://github.com/kadena-io/chainweb-node/blob/8c32fcfff85c4e5b61a9554f0180ca6c90840e42/pact/genesis/devnet/keys.yaml
*/

export interface ChainwebAccount {
  address: string;
  keys: Pact.KeyPair;
}

export const sender00: ChainwebAccount = {
  address: "sender00",
  keys: {
    publicKey:
      "368820f80c324bbc7c2b0610688a7da43e39f91d118732671cd9c7500ff43cca",
    secretKey:
      "251a920c403ae8c8f65f59142316af3c82b631fba46ddea92ee8c95035bd2898",
  },
};

/* We also need to know the address of the wallet user account. In the real
world you would store this in a database, but in this example app we simply
generate new keys on every load of the application.

You can use this as an example of how to generate new keys in your own app!
*/

const userKeys: Pact.KeyPair = Pact.crypto.genKeyPair();

export const userAccount: ChainwebAccount = {
  address: `k:${userKeys.publicKey}`,
  keys: userKeys,
};

export const userKeyset: Pact.KeySet = {
  keys: [userAccount.keys.publicKey],
  pred: "keys-all",
};
