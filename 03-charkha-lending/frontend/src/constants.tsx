/*

In Charkha you are automatically given the 'sender00' account, which has access
to a ton of KDA on the devnet network.

In the real world you should never commit private keys.

*/

import { KeyPair, KeySet } from "pact-lang-api";

export const charkhaAddress: string = "charkha";

// The key pair for the Charkha admin account.
export const charkhaKeyPair: KeyPair = {
  publicKey: "550fdb22682e109b207a19b6b0ee0d069007d9a3eccedcb2eb7809f4f56b5ecf",
  secretKey: "2a9d9112e96e8a299091e067879c50d1cbefbd9c7fff78e2623d7e3f0cd2bf45",
};

export const charkhaKeyset: KeySet = {
  keys: [charkhaKeyPair.publicKey],
  pred: "keys-all",
};

export const sender01Address: string = "sender01";

export const sender01KeyPair: KeyPair = {
  publicKey: "6be2f485a7af75fedb4b7f153a903f7e6000ca4aa501179c91a2450b777bd2a7",
  secretKey: "2beae45b29e850e6b1882ae245b0bab7d0689ebdd0cd777d4314d24d7024b4f7",
};

export const sender01Keyset: KeySet = {
  keys: [sender01KeyPair.publicKey],
  pred: "keys-all",
};
export const sender02Address: string = "sender02";

export const sender02KeyPair: KeyPair = {
  publicKey: "3a9dd532d73dace195dbb64d1dba6572fb783d0fdd324685e32fbda2f89f99a6",
  secretKey: "9b54e924f7acdb03ad4e471308f9a512dac26a50398b41cab8bfe7a496804dbd",
};

export const sender02Keyset: KeySet = {
  keys: [sender02KeyPair.publicKey],
  pred: "keys-all",
};
