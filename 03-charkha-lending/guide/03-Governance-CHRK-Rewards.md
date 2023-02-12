# 3. Governance & CHRK Rewards

**Related Reading**

- [Compound Governance](https://docs.compound.finance/v2/governance/)
- [Pact: Solving Smart Contract Governance & Upgradeability](https://medium.com/kadena-io/pact-solving-smart-contract-governance-and-upgradeability-976aac3bbb31)
- [Governance Capability & Module Admin (Pact language documentation)](https://pact-language.readthedocs.io/en/stable/pact-reference.html#governance-capability-and-module-admin)
- [Building a Voting Dapp Tutorial (Pact user documentation)](https://docs.kadena.io/build/guides/building-a-voting-dapp)

**Charkha Contracts**

- [Governance contract](../contracts/governance.pact)
- [CHRK token contract](../contracts/tokens/chrk.pact)

---

Charkha brings lenders and borrowers together in money markets. The main function of the market is to establish an interest rate, whihc serves as the "price" of money in that market. High interest rates incentivize more lenders to participate, and low interest rates incentivize more borrowers to participate.

The Charkha lending protocol establishes interest rates in each supported money market. Charkha intelligently moves interest rates in response to market activity as described in the Charkha white paper. The rules by which interest rates are set and adjusted will have a huge impact on the markets that lenders and borrowers participate in.

Accordingly, we would like for participants in the lending protocol (lenders and borrowers) to have a say in the interest rate rules. If a majority of participants in a market feel that the interest rate rules should be adjusted — for example, to create a larger pool of reserves to cover bad debts in a volatile market — then the protocol should adjust accordingly, within limits (there always must be a reserve pool, for example).

In Charkha, the community can vote to change a number of factors used to calculate interest rates for a particular market. If the vote succeeds, the change applies right away. In this section of the guide we'll learn more about the governance process Charkha uses and the CHRK rewards token that market participants use to vote.

## Interest Rates in Charkha

Interest rates are largely determined by market utilization, or the ratio of lending to borrowing in a given market; high utilization produces high interest rates. However, Charkha interest rates take into account more than just market utilization. There are several other factors involved on a per-market basis, all of which are values between 0 and 1:

- The _base rate_ is a constant interest rate borrowers must pay regardless of market utilization. It is usually low, like 0.5%. Low-risk markets typically have a low base rate, and high-risk markets (volatile assets) have higher base rates.
- The _multiplier_ is a factor determining how much weight market utilization should have. Risky assets have high multipliers, and low-risk assets (like stablecoins) have low multipliers. In other words, two markets may have a similar interest rate at low utilization, but the riskier market may have a much higher interest rate at high utilization.
- The _collateral ratio_ is used to determine what portion of a user's lent funds can be used as collateral. Volatile assets have low collateral ratios because the value of the user's collateral can swing wildly; if the asset declines too much in value, then the user won't be able to repay their debts. A collateral ratio for a safe asset might be 0.8, which means that lending 1,000 KETH means you can borrow up to 800 KETH worth of other assets.
- The _reserve factor_ is the portion of borrower interest that does not accrue to lenders, but rather to the protocol itself. Charkha's reserves are used to cover bad debts, such as when a borrower's collateral drops significantly in value and they can no longer repay their original loan.

As you can see, several of these factors are used to de-risk volatile assets, at the cost of increasing borrower interest rates in those asset markets. But what happens when the protocol gets it wrong — it considers a market riskier than it actually is, or vice versa? This can easily happen as assets become more or less volatile over time, and the protocol needs to be able to respond by changing its market factors.

Of course, changing market factors can significantly affect participants in that market. In Charkha, no one can unilaterally change market factors. We use a community governance process instead!

## Charkha Governance

Charkha lets CHRK holders vote on proposals to modify factors about a market, such as the market's reserve factor, base rate, or collateral ratio. The governance contract encodes the rules by which votes are carried out:

- **Community-led proposals**.
  Any user who has a CHRK balance can open a new proposal.

- **1 CHRK = 1 vote**.
  Any user who has CHRK can vote for a proposal, and their CHRK balance will apply towards the total "for" or "against" votes. If they transfer or receive CHRK then their vote will change as well.

- **Proposals apply automatically**.
  A proposal includes the change that should be executed, so once accepted it does not require any administrator to implement the change.

In Charkha we've implemented [a governance contract](../contracts/governance.pact) that contains the market factors for each market and an implementation of this voting mechanism. In short, the contract supplies functions to submit a proposal, vote on the proposal, and close / implement a proposal. It also stores the market factors for each market in a table and provides a `(get-market-factors)` function to read them. When we see the controller contract at the end of the guide, you'll see how we use the market factors in the governance contract to calculate interest rates.

If the community votes, the market factors change!

## The CHRK Governance & Rewards Token

We've discussed using the CHRK token for governance, but what exactly _is_ this token? I'll quote the Charkha white paper:

> The Charkha protocol rewards suppliers and borrowers with the CHRK token. This token is distributed to suppliers and borrowers in each market; the more you supply and/or borrow, the more CHRK you receive.

The CHRK token's utility is in its governance capabilities:

> The Charkha protocol is governed by CHRK token holders. Token holders can propose, vote on, and implement changes through the admin functions of the governance contract.

Put together, the CHRK token is received as a reward for lending and borrowing activity, and it can be used to vote to tweak the parameters of the protocol itself. Of course, it is also a KIP-0005 token itself, so users can transfer or trade their CHRK tokens. And, since it's a token supported by Charkha itself, you can also lend or borrow CHRK (for instance, to establish a large position for the sake of a vote you care about).

There is a lot of value in having influence over a large lending protocol. For example, [a16z used their governance holdings in Uniswap to block it from expanding beyond Ethereum](https://tokeninsight.com/en/news/why-did-a16z-vote-against-uniswap-s-latest-expansion). The COMP token used to govern the Compound lending protocol is worth about $50 per token at time of writing. Some lenders and borrowers on Compound have accrued tens of millions of dollars worth of COMP rewards.

### Implementing CHRK

Let's discuss how we might implement a rewards token for participating in our lending protocol. As you read through this section I recommend you also [look at the CHRK token contract](../contracts/tokens/chrk.pact).

We should have some ground rules:

1. It should only be possible to create CHRK via distributing it as a reward (an administrator shouldn't be able to create CHRK from thin air).
2. There should be clear rules about how much CHRK will be released as a reward and how it will be distributed to users of the protocol.

In our case, the Charkha white paper states that there is a maximum supply of 10,000,000 CHRK, 1 CHRK is distributed per market per block, and the CHRK is divided among users of the protocol according to their overall participation. Of course, CHRK is a fungible token, so it must also satisfy the `fungible-v2` interface.

We can encode our rewards rules for CHRK in a handful of functions:

```clojure
(defconst MAX_SUPPLY 10000000)

(defun accrue ())

(defun claim (account:string))
```

We can't actually transfer CHRK to every user who has earned it every block — it would be expensive with a small number of users, and it's impossible with a large number of users. Instead, we separate reward _accrual_ (ie. producing new CHRK) from reward _distribution_ (ie. transferring it to a particular user) so as to minimize gas fees.

#### Accrual

The accrual step mints new CHRK, which can then be claimed by users of the protocol. In the accrual step we only care about how many new CHRK must be produced. Our clear and simple rules:

1. No more than 10 million CHRK can ever be produced
2. One CHRK is produced per block per market

How can we enforce a total supply of CHRK? Naively, we could sum up all the balances in the accounts table and ensure that it never exceeds 10 million. However, this won't work, for a few reasons:

1. Since accruals and claims are separate, the total supply of _claimable_ CHRK will often exceed the actual claimed CHRK as recorded in the account balances. Unclaimed CHRK isn't associated with any account, so it would be missed by the sum.
2. It's expensive to sum all the account balances, especially if there are many accounts! We'd like to keep our gas costs low.

We need to store the total accrued CHRK amount separate from the account balances, and we need to store the total rather than the accrual at any given block to stay performant. You'll see this pattern again and again in Pact: you nearly never want to loop over a table; instead, store summary values in a second table. We'll do just that with a single-row table:

```clojure
(defconst ACCRUALS_KEY "accruals")

(defschema accruals-schema
  accrued:integer)

(deftable accruals:{accruals-schema})
```

Now, when we accrue CHRK we'll write in to the accruals table and we can enforce that we never accrue beyond the 10 million maximum cap. In fact, since we're writing Pact, we can have the model checker verify that it's impossible for our smart contract to exceed our cap!

```diff
 (defschema accruals-schema
+  @model [ (invariant (<= accrued MAX_SUPPLY)) ]
   accrued:integer)
```

We can now satisfy our first rule: no more than 10 million CHRK can be produced. Next, let's turn to our second rule: one CHRK is produced per block per market.

Right away, you should feel suspicious about the "per block" constraint. We can't guarantee that we can get a transaction that includes a call to `(accrue)` into every single block on Chainweb, and it would be prohibitively expensive to do so. We can't actually accrue every single block. However, we _can_ tell how many blocks have elapsed since the last time we accrued CHRK by referring to the block height.

In the diff below we add another field to our summary table. This field records the block height at the time we last updated our accruals.

```diff
 (defschema accruals-schema
   @model [ (invariant (<= accrued MAX_SUPPLY)) ]
+  last-updated:integer
   accrued:integer)
```

The next time we update our accruals we can read the block height from the chain data:

```clojure
(at 'block-height (chain-data))
```

We can then compare the current block height to the `last-updated` block height, and then we know how many blocks have passed since our last accrual. We can also use this information to make sure we _don't_ accrue more than once in a single block! Now, let's revisit our rule:

> One CHRK is produced per block per market.

We've figured out how to meter accruals on a per-block basis. How do we know how many markets the Charkha protocol supports?

In short, the only module that knows the market count is the Charkha controller. This is a problem, because the controller relies on the governance module to set interest rates, and the governance module relies on the CHRK token to count votes, and therefore the CHRK token cannot refer to the controller contract (this would produce a circular dependency).

This leaves us with two options.

1. We can add a `total-markets:integer` field to our summary table, and have an administrator-only function that adds to the total market count.
2. We can use a module reference in the CHRK token contract to lazily fetch the market count from the controller contract whenever we need it, and have an administrator-only function that registers the reference.

I've chosen the second option both because it's worth demonstrating and because I prefer a single source of truth when we can get it. I don't want the controller to have to remember to update the CHRK token contract when registering or de-registering a market: it's too easy to forget.

Let's explore how to accomplish the second option. We need to create a new table to hold on to a reference to the controlling contract. Note the syntax of the reference below — we're saying we need access to a _module_ that implements the _charkha-controller-iface_ interface:

```clojure
(defconst REF_KEY "ref")

(defschema ref
  controller-ref:module{charkha-controller-iface})

(deftable refs:{ref})
```

We'll see what this interface contains later, but one function is `(get-market-count)`. Now, while we have this table instantiated, we also need an `(init)` function where we actually register a reference to the controller contract:

```clojure
(defun init (controller-ref:module{charkha-controller-iface})
  (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset"))
  (insert refs REF_KEY { "controller-ref": controller-ref })
  (insert accruals ACCRUALS_KEY
    { "last-accrued": (at 'block-height (chain-data))
    , "accrued": 0
    }))
```

Once we have registered a reference to the controller contract we can start calling functions from it. For example, here is how we can check the total market count in our `(accrue)` function:

```clojure
(defun accrue:string ()
  (with-read refs REF_KEY
    { "controller-ref" := ref:module{charkha-controller-iface} }
    (let
      ((market-count:integer (ref::get-market-count)))
      ; we can now use the market count in our logic
      ...)))
```

We can now use `market-count` to accrue 1 CHRK per market per block. We can satisfy our accrual rule, with no administrator intervention beyond registering the controller reference during deployment! Keep this trick in mind if you ever have circular dependencies in your contracts.

For a minimal example of this technique, please see the following gist:

<script src="https://gist.github.com/thomashoneyman/bb9007cb8a986693b76a43820ec50998.js"></script>

Our accrual rules are in place. We have everything we need to accrue 1 CHRK per block per market up to a total supply of 10 million CHRK. To see the real-world implementation of the `(accrue)` function, please refer [to the CHRK contract](../contracts/tokens/chrk.pact).

#### Claiming

The `(accrue)` function mints new CHRK, but it doesn't distribute CHRK to market participants. For that we need the `(claim)` function (and `(claim-create)` if claiming to a new account). Unlike `(accrue)`, which is meant to be called regularly by the protocol itself, the `(claim)` function is meant to be called by a user to claim funds for themselves.

The Charkha white paper specifies that CHRK is distributed to market participants based on their overall market participation. That market participation is the value of their total supply & borrows divided by the total value of all markets. The market participation function is included in the controller contract so we won't go into it here.

For the CHRK token, all we need to do is figure out a user's market participation since the last time they claimed rewards and then distribute their share of the total CHRK that accrued during that time. We leave the `(claim)` function unguarded so that the protocol or other users can call it randomly; this prevents a particular user from trying to manipulate their market participation.

Users earn rewards every block, so we once again will snapshot claims with the block in which the claim happened in our accounts table:

```clojure
(defschema account
  @doc "Schema for CHRK account holders."
  last-claimed:integer ; block height
  balance:decimal
  guard:guard)
```

When claiming funds we'll once again rely on the controller ref to call functions from the controller module, and we'll use the last-claimed block height to ensure a user gets rewards over the total duration since their last claim.

Here's an excerpt of the `(claim)` implementation:

```clojure
(with-read refs REF_KEY
  { "controller-ref" := ref:module{charkha-controller-iface} }
  (let
    (
      (share:decimal (ref::market-participation account))
      (blocks:integer (- (at 'block-height (chain-data)) last-claimed))
      (markets:integer (ref::get-market-count))
    )
    (write accounts account
      { "balance": (+ balance (* markets (* blocks share)))
      , "last-claimed": (at 'block-height (chain-data))
      , "guard": guard
      }))))
```

## Wrapping Up

We've now seen how to implement a fungible rewards token that has a custom distribution schedule and can only be claimed by market participants under certain circumstances. In the next section of the guide we will turn to the controller contract itself.
