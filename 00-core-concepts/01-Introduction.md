# 1. Introduction to Blockchain Development with Kadena

Blockchain development is a departure from typical web development. I encountered a set of unfamiliar technologies with little idea of how they fit together, their limitations, and how to design programs for a radically different computing environment than a typical web application. It can be overwhelming.

Yet blockchain technology is fascinating, not least because it enables a class of applications not previously possible. It's worth working through the disorienting initial experience to understand how blockchain development works and what applications it makes possible.

I chose to develop my first blockchain application on Chainweb (Kadena's public blockchain). Chainweb is a great choice for web3 apps because of its low gas fees, multi-chain architecture, but mostly because of Kadena's well-designed smart contract language, Pact.

This short article series introduces you to the basics of blockchain development with Kadena. It only gives you a map of the territory: we won't go deep. We begin with an overview of blockchain technology in general and the Kadena ecosystem in particular; in subsequent articles you will learn to write and test smart contracts in the Pact language.

Without further ado: let's begin the crash course!

## Web3 & Blockchain Technology

We should be clear about what "blockchain technology" is. You will see the terms _web3_ and _blockchain technology_ used when discussing applications that use a blockchain as a medium of record. A blockchain is type of digital ledger that typically combines the following concepts:

- **Data storage**: Blockchains store data. They are best suited to transactional data (financial transactions, sales records, logging important events, and so on) rather than bulk file storage.
- **Replication**: Blockchains replicate the stored data across many systems in real time. Public blockchains like Chainweb, Bitcoin, and Ethereum broadcast all data to all participants and are therefore fully transparent, but it is possible to build blockchains that are more selective about where they send data.
- **Decentralization**: Blockchains don't follow the client-server architecture seen in typical web development. Instead, applications are hosted on distributed networks of nodes (peers). Information is "gossiped" from node to node instead of being broadcast by a centralized source.
- **Consensus mechanisms**: Since there is no central source of trusted data, nodes in a blockchain network instead use various consensus mechanisms to validate data. The two most common are Proof of Work (PoW) and Proof of Stake (PoS). When developers refer to the integrity or security of a network they are referring to how well its chosen consensus mechanisms are working.
- **Cryptography**: Blockchains use cryptographic methods like digital signatures to prove ownership and authenticity and cryptographic hashes to reference data and make any data tampering evident. Users are expected to prove their ownership of an asset with a digital signature, for example, before they can transfer it.
- **Smart contracts**: Many (but not all) blockchain platforms support self-executing programs called smart contracts. Smart contracts are stored on-chain and, when executed, can read and write data depending on the rules written into the contract. They are roughly analogous to database stored procedures. Since contract code is executed on a node, a blockchain that supports smart contracts therefore also provides a limited virtual machine. The same way you pay AWS to execute some code in the cloud, you (or your users) pay gas fees to execute smart contracts on a blockchain. Smart contracts form the core of most web3 applications.

Blockchains aren't a monolithic invention. Instead, they combine several technologies and techniques together to achieve desirable properties of decentralization, scalability, and security. Most applications don't need all three properties and do just fine without a blockchain, but some applications - digital currencies, decentralized finance, decentralized record of ownership (NFTs) - become practical with blockchain technology.

There are many blockchain platforms because there are many ways to implement each concept above. How does the blockchain store data? How does it replicate that data in real time? What consensus mechanism does it use to secure that data? How does it balance its goals of decentralization, security, and scalability? For blockchains that support smart contracts, how much does a computation cost (what are the gas fees)? Each blockchain platform chooses different tradeoffs.

While some web3 applications exist almost entirely in the form of smart contracts on a blockchain, most will continue to use web servers and databases in addition to a blockchain. That's because blockchains sacrifice some desirable properties to achieve decentralization.

For example, smart contracts can take anywhere from 15 seconds to a minute and a half to process a computation. That's because a node doesn't just execute the code - it must then reach consensus with the rest of the network about the result before. As another example, blockchains are a poor choice for general data storage because the data must be replicated across the network and will remain in the blockchain history forever. This is slow, expensive, and wasteful for data that doesn't benefit from that level of security.

You should use blockchain technology for parts of your application that will benefit from it, but you should not expect to be able to simply replace your backend with a blockchain. In the next few sections we'll look at the specific technologies that Kadena provides for blockchain development, namely:

- **Chainweb**, a public, proof-of-work blockchain with low gas fees and a unique multi-chain architecture that allows for high transaction throughput.
- **Pact**, a smart contract programming language that emphasizes security and correctness.
- **Kadena.js**, a collection of JavaScript libraries for interacting with Chainweb nodes and working with Pact code.

## Chainweb: Kadena's Public Proof-of-Work Blockchain

Chainweb is Kadena's public blockchain offering. Its most notable feature is that it isn't a single blockchain - it is instead many independent blockchains which run in parallel and possess mechanisms for communicating with one another. This pioneering architecture is why Chainweb is able to scale transaction throughput far beyond single chains like Ethereum. It's described in-depth in the [Chainweb white paper](https://d31d887a-c1e0-47c2-aa51-c69f9f998b07.filesusr.com/ugd/86a16f_029c9991469e4565a7c334dd716345f4.pdf).

Chainweb is a public blockchain. That means there is a distributed network of computers running the [Chainweb node software](https://github.com/kadena-io/chainweb-node); one such node is located at [api.chainweb.com](https://api.chainweb.com/openapi). Each Chainweb node stores data in a local database, exposes an API so it can be sent new data and transactions, executes Pact smart contract code when received, and broadcasts data and transactions to other nodes. You can run your own node if you would like; indeed, most real-world applications should.

It is also a proof-of-work blockchain. That means that nodes in the network compete to solve mathematical problems, where the first miner to solve the problem gets to write a block to the blockchain and is rewarded with a certain amount of KDA. Miners run Chainweb nodes on specialized hardware and are critical to the security of the network - to manipulate the blockchain's data, an attacker would need to control more than 50% of the network's total computational power. The more miners there are the more difficult this is.

You can view Chainweb as a platform for storing data and running smart contract code, where a Chainweb node exposes the platform API. To execute your smart contracts you will send Pact code that calls a function from your contract to a [Chainweb node's Pact API](https://api.chainweb.com/openapi/pact.html) as a transaction. The node will broadcast your transaction and evaluate the code. Other nodes will do the same, and at some point your transaction will be written into a block by a miner and become part of the official history of the blockchain, along with the effects of that transaction (such as any database writes you included).

Chainweb is well-known for high transaction throughput. On a single chain a block is written on average every 30 seconds, and a block can contain many transactions. This isn't particularly fast. But since chains run in parallel, Chainweb is able to handle a high overall throughput. [In 2020 the network moved from 10 to 20 chains](https://medium.com/kadena-io/kadena-completes-hybrid-blockchain-scaling-to-480-000-transactions-per-second-on-20-chains-5a652295533c), achieving a maximum throughput of 480,000 transactions per second. It can move to higher numbers of chains in the future, further increasing throughput.

You or your users pay for the cost of executing a smart contract in the form of "gas fees". These are transaction fees paid to miners. The more computationally-intensive the smart contract call, the higher the gas fees.

Chainweb is also known for dirt-cheap gas fees. A typical transaction like a KDA transfer requires about 700 units of gas, and gas prices are usually below 0.0000001 KDA per unit. At current KDA prices that works out to about $0.00007 USD for a transfer, or just a fraction of a cent!

> Notably, you only pay gas fees when you send a transaction that changes the state of the blockchain and must be broadcast to other nodes. Chainweb nodes can also receive read-only requests, called "local" requests. These requests might be queries to read account details or look up specific transactions; they are fast and free.

Every transaction sent to Chainweb requires a sender, or an account responsible for paying gas, who must have signed the transaction. A typical user account on Chainweb begins with the prefix `k:` followed by a public key; it is the private key associated with this public key that must sign the transaction ([there are other account types](https://medium.com/kadena-io/introducing-kadena-account-protocols-kip-0012-303462b77af1), but you should begin with your own `k:` account first). The transaction sender must have sufficient KDA in their account to pay the gas fees.

If you would like to learn more about sending transactions to a Chainweb node, please begin with [the faucet project of Real World Pact](https://github.com/thomashoneyman/real-world-pact/tree/main/01-faucet-contract).

## Pact: Kadena's Secure Smart Contract Language

Smart contracts make the difference between single-purpose blockchains like Bitcoin and general-purpose blockchains like Chainweb or Ethereum. [Pact is Kadena's smart contract language](https://github.com/kadena-io/pact), and it makes a wonderful set of design decisions that sets it apart from other blockchain smart contract languages such as Ethereum's Solidity. Some of these features include:

- **Human readable**: Pact code is stored on-chain directly. Other languages like Solidity are compiled to bytecode and deployed; while you can decompile the code, you can't see the exact source code. This makes verifying the security of these contracts difficult.
- **Turing-incomplete**: Pact code disallows recursion and loops. It's easy to write an infinite loop, which-if never terminated-would hang the entire blockchain network. Other blockchain languages rely on the gas model to terminate long-running code when it exceeds a gas limit; Pact instead makes it impossible to write infinite loops in the first place. Turing-incompleteness eliminates a whole class of potential bugs.
- **Built-in formal verification**: The Pact language has built-in language support for static type checking and formal verification, which can be used to guarantee (via the Z3 theorem prover) that certain states are impossible to reach in your program. For example, you can guarantee that as account balance never becomes negative. Once again, you can formally rule out entire swathes of potential bugs and security issues.
- **Atomic execution**: When an error occurs in Pact code, the entire transaction is rolled back. If the code does not succeed, the state of the blockchain does not change.
- **Built-in data storage**: The Pact language has built-in support for defining and working with databases. They are typically defined as part of the smart contract itself, though access to the database is constrained to the smart contract-other users can't arbitrarily write to a database.
- **Multi-sig public-key authorization**: Pact supports simple public-key authorization as seen in Bitcoin. It also trivially supports multi-sig authorization via the concept of keysets, which can encode authorization rules ranging from "all keys must sign" to custom predicate functions defined in a smart contract.
- **Zero-knowledge primitives**: Zero-knowledge proofs are a new innovation in cryptography that can be used to provide privacy for transactions or to help run some computations off-chain and then mine a block containing their aggregated results so as to ease congestion. Pact contains language primitives for working with zero-knowledge proofs and rollups directly.
- **Scoped access control**: Pact allows you to scope your signature on a transaction to a specific capability, or section of code, rather than signing off on an entire transaction as a whole. This is a significant security improvement because it prevents signatures from being abused to approve actions a user did not intend, especially when a smart contract calls out to other smart contracts.
- **Pacts**: The namesake of Pact, this feature enables safe transfers of state from one chain to another-the foundation of Chainweb's scalability.

The list of Pact features can go on and on, but in short: it's a wonderfully-designed smart contract language and a serious productivity boost for your smart contract development once you get the hang of it.

Smart contracts containing Pact code are deployed to Chainweb by sending a Pact module (the main unit for code organization in the language) as a transaction to the network. Once the transaction is mined into a block the contract becomes public. Unlike other blockchains, Pact modules can be upgraded to fix bugs, if the module's governance function allows it. Some modules enforce that they cannot be upgraded; others only allow an administrator to upgrade them; still others rely on a vote from a decentralized autonomous organization to determine if they can be upgraded.

Once your Pact smart contract is live on Chainweb you can use the public API of a Chainweb node to call functions from the module according to the module name. For example, code from the module below can be called by  sending the Pact code (coin.my-function) to a Chainweb node.

```clj
(module coin ...
  (defun my-function ()
    ...)
)
```

The Real World Pact project series demonstrates this full process in-depth.

## Kadena.js: Kadena's JavaScript Toolkit
Chainweb and Pact are the backbone of applications built on the Kadena platform. Smart contract developers will spend most of their time working with these technologies. 

However, few people want to interact with smart contracts directly. Instead, most will interact with smart contracts via a typical web frontend written in JavaScript. For example, [ecko](https://swap.ecko.finance) may be implemented as a collection of Pact smart contracts on Chainweb, but most users will connect a wallet to their frontend in order to interact with the contracts.

When you are ready to build a frontend against your blockchain backend you will most likely turn to [Kadena.js](https://github.com/kadena-community/kadena.js), Kadena's software developer kit for JavaScript. These libraries include (among others):

- [`chainweb-node-client`](https://github.com/kadena-community/kadena.js/tree/master/packages/libs/chainweb-node-client): A TypeScript library to make requests to  the API endpoints on a Chainweb node.
- [`cryptography-utils`](https://github.com/kadena-community/kadena.js/tree/master/packages/libs/cryptography-utils): A collection of low-level cryptography utilities useful when e.g. signing transactions.
- [`client`](https://github.com/kadena-community/kadena.js/tree/master/packages/libs/client): The primary Kadena.js library, which provides (among other things) utilities for generating JavaScript code from a Pact contract, connecting with wallet providers to sign transactions, and functions for formatting transactions for use with Chainweb.

You will also see many projects continuing to use [`pact-lang-api`](https://github.com/kadena-io/pact-lang-api), a small JavaScript library for working with Pact that is being replaced by Kadena.js.

## Fundamental Kadena Contracts
The Pact language comes with plenty of built-in features. Even so, you sometimes need to rely on code written in an existing smart contract to implement your own smart contract, the same way you might rely on a library in another programming language.

One reason to rely on other smart contracts is that Pact supports interfaces. Interfaces are code that defines types and functions but does not provide implementations. Interfaces are a way to enforce, in code, a specific API that many smart contracts can use. For example, the fungible interface describes requirements for implementing a fungible token in Pact (one example: the KDA token itself!). Other smart contracts can then be written to work with any arbitrary token so long as it implements this interface, instead of hard-coding support for specific tokens. It's a powerful and often-used feature.

Another reason to rely on other smart contracts is because you need some functionality from them. For example, the pact-util-lib collection of smart contracts provides many utilities for common string, numeric, and other operations that you may use instead of implementing them yourself. You may also need to rely on a contract like coin, which defines the KDA token, to implement a feature in your app-such as a user transferring KDA to you for some purpose.

Here is a short list of contracts that you should know about as you begin your blockchain development journey with Kadena:

- [`coin`](https://github.com/kadena-io/chainweb-node/blob/master/pact/coin-contract/v5/coin-v5.pact): Defines the KDA token and provides functions to transfer KDA, create accounts, and more.
- [`fungible`](https://github.com/kadena-io/chainweb-node/blob/master/pact/coin-contract/v2/fungible-v2.pact): Defines the interface for fungible tokens according to the KIP-0005 standard (similar to the [ERC-20 token standard for Ethereum](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/))
- [`fungible-xchain`](https://github.com/kadena-io/chainweb-node/blob/master/pact/coin-contract/v4/fungible-xchain-v1.pact): Defines the interface for cross-chain fungible token transfers, ie. the ability to move assets from one chain to another chain.
- [`poly-fungible`](https://github.com/kadena-io/KIPs/blob/master/kip-0011/poly-fungible-v1.pact): Defines a combined interface for fungible, non-fungible (NFTs), and everything in between. 
- [`marmalade.ledger`](https://github.com/kadena-io/marmalade/blob/main/pact/ledger.pact): If you are interested in NFTs then you will most likely use [Marmalade](https://github.com/kadena-io/marmalade), a collection of contracts and infrastructure for creating NFTs and associating rich metadata with them.
- [`util.guards`](https://github.com/kadena-community/mainnet-utils/blob/master/util/guards/guards.pact), [`util.guards1`](https://github.com/kadena-community/mainnet-utils/blob/master/util/guards1/guards1.pact): Utility functions from the Kadena team for working with custom guards (predicate functions for enforcement).

## Wrapping Up
This article was a rapid introduction to the core technologies and contracts you will encounter when you begin blockchain development on the Kadena platform. 

You'll write smart contracts in Pact and deploy them to Chainweb, perhaps referring to other foundational contracts that have already been deployed. Then, frontends can interact with these contracts via the Kadena.js libraries.
We've barely scratched the surface, but you now have a map of the territory and can dive deeper into any of these topics depending on your interests. If your interest is smart contract development, then continue on through the series to learn how to write smart contracts with Pact!
