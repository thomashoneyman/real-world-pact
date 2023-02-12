# 4. The Charkha Controller

**Charkha Contracts**

- [Controller contract](../contracts/controller.pact)
- [Full protocol tests](../contracts/test.repl)

---

Over the last few sections of the guide we built foundational infrastructure for the Charkha lending protocol. We established a way to value assets against one another (the price oracle). We created our own fungible token to use as an asset (KETH). We created three market tokens that represent a user's collateral (cwKDA, cwKETH, cwCHRK). We also established a fungible rewards & voting token, CHRK, and a governance module that lets market participants create and vote on proposals.

Now, it's time to bring everything together. Let's break down the responsibilities of the various contracts.

1. **Oracle**: Provides price information for various assets in USD
2. **KETH, KDA**: Fungible tokens supported as assets.
3. **cwKDA**, **cwKETH**, **cwCHRK**: Market tokens that represent collateral and record state about participants in a given market, such as their total borrow and supply balances
4. **CHRK**: Fungible token supported as an asset, which also accrues to users based on their overall market participation (as recorded in the cwToken contracts)
5. **Governance**: Records market factors such as the base rate, reserve factor, collateral ratio, etc. for each market and provides a community voting mechanism to change these factors.
6. **Controller**: Records overall market state such as interest rates, exchange rates, total supply and borrows, and more about each market. Coordinates all of the other modules in response to user actions like lending and borrowing. Provides a liquidation mechanism so anyone can reduce the protocol's exposure to bad debt.

As a general rule:

1. State about market _participants_ goes in the market token contracts (like cwKDA).
2. State about community-determined market _factors_ goes in the governance contract.
3. Overall market state goes in the controller contract.

Let's take a look at the state we will record about a given market and some of the invariants we want formal verification to maintain for us:

```clojure
(defschema market-state
  @model
    [ (invariant (> total-supply total-borrows))
      (invariant (>= total-supply 0))
      (invariant (>= total-reserves 0))
      (invariant (>= total-borrows 0))
      (invariant (>= interest-rate-index 1.0
	  (invariant (>= exchange-rate 50.0))
    ]

  total-borrows:decimal
  total-supply:decimal
  total-reserves:decimal
  last-updated:integer ; block height

  interest-rate-index:decimal
  exchange-rate:decimal
  reward-share:decimal)
```

You may be wondering why we would store a market's total borrows and total supply in our market state — wouldn't it be more accurate to just sum up all the borrows as recorded in the market token contract for the given market? As usual, we record summary information like this for performance reasons. We'll get into that in-depth later in this section.

One more thing: when we implemented the market tokens and CHRK we had to deal with some circular dependencies in our contracts. For example, when the controlling contract wants to calculate a user's borrowing capacity across all markets, it needs to call each of the market token contracts to get the user's total supply and borrows in that market. When a user wants to transfer their market tokens (such as cwKDA) to another user, the market contract must call the controlling contract to ensure the transfer won't reduce the user's borrowing capacity below acceptable limits. We have a circular dependency!

We need to hold on to a reference to the market contract (ie. cwKDA) for each market we support so we can query it for information like current borrows. We also need to refer to the token contract (ie. KDA) for each underlying asset so we can `(transfer)` funds from lenders to the protocol and vice versa. Let's add those two module references to the market state and stub a function that allows registering a new market:

```clojure
(defschema market-state
  ...
  market-ref:module{charkha-market-iface}
  token-ref:module{fungible-v2})

(defun register-market:string (market:string token:module{fungible-v2} market:module{charkha-market-iface})
  @doc "Register a new market and associated modules.")
```

Now that we've seen the state we will maintain about each market, let's take a look at the main functions of the controller contract. (It has several more, but these are the most important; all others are in support of these main protocol interactions.)

```clojure
(defun supply:string (account:string market:string amount:decimal)
  @doc
    "Supply AMOUNT of the underlying asset for this market from account \
    \ACCOUNT. You will receive the equivalent cwTokens according to the \
    \exchange rate in return.")

(defun redeem:string (account:string market:string tokens:decimal)
  @doc
    "Redeem AMOUNT of cTokens in exchange for the equivalent amount of the    \
    \underlying asset.")

(defun borrow:string (account:string guard:guard market:string amount:decimal)
  @doc
    "Borrow AMOUNT of the underlying asset for this market and send it to    \
    \ACCOUNT. Will fail if the account has insufficient collateral.")

(defun repay:string (account:string market:string amount:decimal)
  @doc "Repay AMOUNT of the underlying asset.")

(defun liquidate:string (liquidator:string account:string market:string amount:decimal)
  @doc
    "Repay AMOUNT of the underlying asset on behalf of ACCOUNT to receive    \
    \their collateral at a discount (liquidator pays 95% of the value of the \
    \collateral), if the account exceeded their borrowing capacity.")

(defun sync-protocol:string ()
  @doc
    "Synchronizes the protocol by compounding interest, updating exchange    \
    \rates, and accruing CHRK rewards. Should be run on every protocol       \
    \interaction, e.g. on lend, borrow, redeem, repay, liquidate, etc."
```

Over the rest of this guide we'll take a look at how to think through implementing these functions!

## Lending Assets

Let's start with a short preview of the `(supply)` function, which lets users lend assets to the protocol and begin earning interest. Then we'll break down some of the formulas involved, such as the interest rate index and the exchange rate.

When you lend an asset on Charkha you provide your KDA, KETH, or CHRK to a lending pool, and in exchange you receive cwKDA, cwKETH, or cwCHRK that represents a claim on the assets you have provided. You can reedem your token for the underlying asset at any time.

The reason you receive a claim on the underlying asset is because Charkha needs to be able to transfer your asset to other users of the platform. Once you lend KDA, for example, that exact KDA goes into the lending pool. When another user comes along and wants to borrow KDA, they might receive the KDA you put into the pool. Charkha has guard rails and incentives in place to ensure you can always reclaim your KDA.

When a user lends an asset such as KDA to the Charkha pools, then the equivalent amount of cwKDA is minted and associated with their account. When the user wishes to reclaim their KDA, then the correct amount of cwKDA is destroyed and the user receives KDA from the pool.

Before we move on, think for a moment: how does the market token module know how much cwKDA should be minted?

Minting cwKDA requires coordination between the controller module and the market token module: the controller knows when KDA was deposited, but only the market token can mint cwKDA. The entire process needs to happen with no admin intervention — we can't just write a `(mint)` function that the administrator calls with the correct amount, for example.

To make this work we applied a two-step process in which:

1. The controller records how much KDA was deposited to the protocol and tells the market token to credit the user.
2. The market token looks up how much cwKDA is owed to the user in the controller contract and applies the credit.

This process allows crediting or debiting cwKDA with no signatures, just some coordination between the two contracts. We can make that work by creating a table recording pending balance changes in the controller contract:

```clojure
(defschema balance-change
  market:string
  ; These two fields describe how much to add to or remove from the user's
  ; supply and/or borrow balances. Negative values indicate debits and
  ; positive values indicate credits.
  supply:decimal
  borrow:decimal)

; We also need to supply a function market tokens can call to read the contents
; of the database.
(defun get-pending-balance-change:object{balance-change} (account:string market:string))
```

When it comes time to change a user's cwToken balance, the controller can update this table, tell the market token module to update the balance, and then reset the pending balance change to zero. This is a lot to take in all at once, so let's see how to actually apply this in the `(supply)` function, in which a user transfers funds to the protocol and receives cwTokens in exchange:

```clojure
(defun supply:string (account:string market:string amount:decimal)
  ; The white paper specifies that we compound interest and recalculate
  ; interest rates before any protocol interaction.
  (with-capability (INTERNAL) (sync-protocol))

  ; You'll see this pattern often: we read the market state for the given
  ; market, including its token and market references. The controller often
  ; reads information about a market from the module reference.
  (with-read markets-table market
    { "total-supply" := total-supply
    , "token-ref" := token-ref:module{fungible-v2}
    , "market-ref" := market-ref:module{charkha-market-iface}
    }

    ; We attempt to transfer funds from the user account to the protocol. This
    ; only succeeds if the user signed the transaction with the TRANSFER
    ; capability, so it can't be called by just anyone.
    (token-ref::transfer account "charkha" amount)

    ; If the transfer succeeds, then we record a pending balance change that
    ; credits the user's supply in the given market.
    (write balance-change-table account
      { "market": market
      , "supply": amount
      , "borrow": 0.0
      })

    ; Then we tell market to update the allocation for the account in question
    ; (ie. credit the account with its funds).
    (market-ref::apply-balance-change account (at 'guard (token-ref::details account)))

    ; Then we reset the allocation to 0.0 so any further calls to
    ; (apply-balance-change) have no effect.
    (update balance-change-table account { "borrow": 0.0, "supply": 0.0 })

    ; We can then update our market state to reflect the new total supply.
    (update markets-table market { "total-supply": (+ amount total-supply) })))
```

Voila! The `(supply)` function is complete.

## Calculating Interest Rates

Next, let's step back and think about our market state. What, exactly, is the "interest rate index" and the "exchange rate"? How are they used to actually accrue borrower and supplier interest?

In Charkha, interest rates are described as an APR (annual percentage rate) in the UI and in the white paper. Interest compounds on every block.

That last sentence should give you pause. Any time a smart contract takes an action at a rapid interval or on a potentially large number of items you are almost certainly going to hit a performance wall. Remember, if some action needs to happen every block (such as earning interest), then a) it must fit in a single transaction, or a maximum of 150,000 gas units, and b) it must be OK for the action to miss blocks, as you cannot guarantee you will be able to get a transaction into every block. The first factor affects the second; the more gas your transaction takes, the more likely it won't be able to fit into the next block (each block is capped at 150,000 gas units for all included transactions).

### Performance Considerations: Interest Rate Index

We can't afford to calculate the interest earned or owed for every user participating in the Charkha protocol all the time. As a general rule, you will never be able to take some action "for all X" in a smart contract unless X is very small. Yet it is completely normal for a business to take an action for all accounts, or all cardmembers, or all X — so we need to come up with alternatives.

Charkha uses a common technique to solve this problem. The technique is to maintain a minimal contract state that is updated every smart contract interaction — such as the market's overall interest rate — and then combine it with a much richer user state each time _that_ user interacts with the protocol. Your design task is to figure out the minimum possible information you can maintain on every interaction such that you can still figure out all the details you need when a user moves to deposit, withdraw, or take some other significant action. We don't calculate how much interest a user is owed, for example, until they interact with the protocol.

What is the minimum state Charkha needs to construct how much interest a user has earned at the time they claim their assets? And how do we ensure recalculating this state is a fast, cheap operation?

We already know we can't measure their accrual each block. Instead, we need some kind of _index_ we can use to refer to interest rates over time.

A naive solution is to store the market's current interest rate in a list; when a user borrows funds you record the current index (ie. `1`) and when they repay funds you compound every interest rate encountered from that index to the present moment. But this again becomes unacceptably inefficient: there are roughly 1 million blocks per year! A list of each block's interest rate will get out of hand immediately.

A better solution is to go ahead and compound the interest rate every block. As described in the white paper, we can start a market with an interest rate index value (such as 1), and on every protocol interaction we calculate the interest rate and compound it on that index value. The growth of the index value over time represents the effects of the interest rate. We have eliminated our enormous list!

With the interest rate index in place, all we need to know about an account to determine their interest owed is to record the interest rate index at the time they lend, along with the lent amount, and then compare it to the interest rate index at the time they move to reclaim their assets. We've successfully minimized our state.

### Handling Fungible cwTokens: Exchange Rates

However, we have another wrinkle. Users are free to trade claims on their assets (ie. you can send your cwKDA to another account), and claims are fungible (we can't uniquely identify one cwKDA from another). How are we supposed to determine how much interest some cwKDA has earned, when it has been traded and intermingled with cwKDA obtained at another time? Or when the cwKDA was liquidated from another user's account? This is, once again, too much data to keep track of in the world of smart contracts.

> We don't have the same issue with borrows. You can do anything you want with the asset you borrowed, and Charkha will remember how much you borrowed. You can't "sell" your debt, it can only be repaid by you or by someone else liquidating your collateral.

Once again, we are forced to abstract information. This time, we can't record the interest earned for a specific balance by checking the interest rate index when it was deposited and again when it was claimed. We're going to have to find another way.

The answer, again, is to use an index. Specifically, instead of storing the entry and exit times of a particular lend, we'll divorce the price of a cw token from its underlying asset. The interest rate index will apply to the value of the cw token in general, which we can represent via the _exchange rate_ of a cw token for its underlying asset.

In other words, 1 cwKDA will not be a claim on 1 KDA. Instead, it might begin that way, the same way our interest rate index began at 1. But over time the relationship between cwKDA and KDA will diverge according to the interest rate index. Eventually, 1 cwKDA might represent a claim on 10 KDA.

We've once again taken some continuous process and captured it in a single variable, a multiplier. You'll see this process all over smart contracts.

In this case, the exchange rate multiplier is only possible because we can control the minting process for cw tokens. The only way to mint a cw token is to lend its underlying asset, and claiming the asset eliminates the associated cw token. The total supply of the cw token is equal to the total amount of the asset that has been lent out!

## Synchronizing the Protocol

In the controller contract there is a `(sync-protocol)` function that should be called before every protocol interaction, as described in the Charkha white paper. This function is responsible for accruing interest and updating interest and exchange rates. We can't guarantee that interest will accrue every block, for the same reasons we can't guarantee that CHRK rewards will accrue every block. But we can apply interest rate changes over the _N_ blocks since the last update.

That's what the helper functions `(sync-market-reward-share)` and `(sync-market-interest)` are for. Below, I've excerpted just the market interest sync function. I recommend that you open up the Charkha white paper and look at the formulas it contains for utilization, interest rates, and exchange rates, and then see how those formulas are translated into Pact code here. You'll see that it's a fairly direct translation!

```clojure
(defun sync-market-interest:decimal (market:string)
  (require-capability (INTERNAL))
  (with-read markets-table market
    { "total-borrows" := total-borrows
    , "total-supply" := total-supply
    , "total-reserves" := total-reserves
    , "exchange-rate" := exchange-rate
    , "interest-rate-index" := interest-rate-index
    , "last-updated" := last-updated
    }
    (bind (free.charkha-governance.get-market-factors market)
      { "base-rate" := base-rate:decimal
      , "multiplier" := multiplier:decimal
      , "reserve-factor" := reserve-factor:decimal
      }
      (let*
        (
          (utilization:decimal (get-utilization market))
          (borrow-interest-rate:decimal (get-borrow-interest-rate market))
          (supply-interest-rate:decimal (get-supply-interest-rate market))
          (blocks:integer (- (at 'block-height (chain-data)) last-updated))
          (apr-share:decimal (/ blocks BLOCKS_PER_YEAR))

          (new-interest-index:decimal (floor (* interest-rate-index (+ 1 (* borrow-interest-rate apr-share))) (coin.precision)))
          (new-borrows:decimal (floor (* total-borrows new-interest-index) (coin.precision)))
          (new-reserves:decimal (floor (+ total-reserves (* total-borrows (* reserve-factor (* borrow-interest-rate apr-share)))) (coin.precision)))
          (new-exchange-rate:decimal (floor (* exchange-rate (+ 1 (* supply-interest-rate apr-share))) (coin.precision)))
		)

		(update markets-table market
		  { "total-borrows": new-borrows
		  , "total-reserves": new-reserves
		  , "exchange-rate": new-exchange-rate
		  , "interest-rate-index": new-interest-index
		  , "last-updated": (at 'block-height (chain-data))
		  })

        (* (free.charkha-oracle.get-price market) (+ new-borrows total-supply)))))))))
```

## Wrapping Up

The controller contract has much more than we've discussed in this guide. However, as you browse through the contract I hope you can see that each function plays a clearly-defined role in supporting the supply, redeem, borrow, repay, and liquidate functions of the protocol: the major activities that Charkha supports to produce working money markets.
