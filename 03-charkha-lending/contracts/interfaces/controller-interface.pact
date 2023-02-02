; The controller interface contains summary information about the markets the
; protocol supports and provides the primary Charkha functionality: lending,
; borrowing, and liquidating. Most of a user's interactions with Charkha will
; go through a contract implementing this interface.
;
; There is only one controller contract, so why do we need an interface? We
; need an interface because the individual markets (like cwKDA) refer to
; functions from this contract, and this interface in turn refers to functions
; from the individual markets. To make this circular reference possible we store
; module references in our database tables. We deploy the interfaces first, then
; the contracts, and then we perform an initialization step to write the mutual
; module references in each contract's tables.
(namespace "free")

(interface charkha-controller-iface
  @doc
    "Interface for Charkha markets (cwKDA, etc.) containing schemas, caps,     \
    \and functions necessary for a market to function in conjunction with the  \
    \governance and Charkha contracts."

  ; ----------
  ; SCHEMA

  (defschema market-state
    @doc
      "Schema for the state maintained about a market, updated on each market  \
      \operation."

    @model
      [ (invariant (> total-supply total-borrows))
        (invariant (>= total-supply 0))
        (invariant (>= total-reserves 0))
        (invariant (>= total-borrows 0))
        ; The exchange rate begins at 50:1 and should only increase from there.
        (invariant (>= exchange-rate 50.0))
      ]

    total-borrows:decimal
    total-supply:decimal
    total-reserves:decimal
    last-updated:integer ; block height

    ; These two rates require more information to calculate than the market
    ; contract has available, but they can be produced using references to the
    ; governance contract.
    interest-rate-index:decimal
    exchange-rate:decimal
    reward-share:decimal

    ; We maintain a reference to the market module so we can query it for
    ; information such as current borrows.
    market-ref:module{charkha-market-iface}
    ; We maintain a reference to the underlying token module so we can access
    ; functionality like (transfer).
    token-ref:module{fungible-v2})

  ; We will use a balance change  table to coordinate between the market
  ; contracts, which have the power to credit or debit tokens, and this
  ; controller contract, which controls the actual lending and borrowing
  ; activity. When a user lends or borrows in a market we will set their
  ; allocation (positive for a credit, negative for a debit) in that market.
  ; Then we will call the associated market contract to move those funds and
  ; reset the allocation to 0. We only need to track at most 1 pending
  ; debit/credit at a time per account.
  (defschema balance-change
    @doc
      "A summary row recording the amount of pending credits or debits for an  \
      \account that has borrowed or supplied."

    market:string
    supply:decimal
    borrow:decimal)

  ; ----------
  ; CAPABILITIES

  (defcap ADMIN:bool ()
    @doc "A capability for admin-only actions."
    @model [ (property (authorized-by "free.charkha-admin-keyset")) ])

  ; ----------
  ; FUNCTIONS

  (defun register-market:string
    ( market:string
      token-ref:module{fungible-v2}
      market-ref:module{charkha-market-iface}
    )
    @doc "Register a new market and associated module.")

  (defun get-pending-balance-change:object{balance-change} (account:string market:string)
    @doc "Read pending credits or debits to an account in a market. Internal.")

  (defun liquidation-eligible:decimal (account:string market:string)
    @doc
      "Get the amount of the user's tokens in the given market that are        \
      \eligible for purchase by a liquidator at a discount.")

  (defun borrowing-capacity:decimal (account:string denomination:string)
    @doc "Get an account's borrowing capacity in a particular denomination.")

  (defun borrowing-capacity-usd:decimal (account:string)
    @doc "Get an account's borrowing capacity in USD.")

  (defun get-market-count:integer ()
    @doc "Get the current count of markets.")

  (defun get-market-names:[string] ()
    @doc "Get the names of supported markets.")

  (defun market-participation:decimal (account:string)
    @doc "Measure an account's participation across all markets as a percentage.")

  (defun get-market:object{market-state} (market:string)
    @doc "Read the details of the market state.")

  (defun get-interest-rate-index:decimal (market:string)
    @doc "Read the interest rate of the given market.")

  (defun get-exchange-rate:decimal (market:string)
    @doc "Read the exchange rate of the given market.")

  (defun get-utilization:decimal (market:string)
    @doc
      "Calculates the total utilization of the given market, ie.the borrows    \
      \over the total borrows + cash")

  (defun get-borrow-interest-rate:decimal (market:string)
    @doc "Calculates the current borrow interest rate in the given market.")

  (defun get-supply-interest-rate:decimal (market:string)
    @doc "Calculates the current supply interest rate in the given market.")

  (defun supply:string (account:string market:string amount:decimal)
    @doc
      "Supply AMOUNT of the underlying asset for this market from account      \
      \ACCOUNT. You will receive the equivalent cTokens according to the       \
      \exchange rate in return."

    @model [ (property (!= account "")) (property (> amount 0.0)) ])

  (defun redeem:string (account:string market:string tokens:decimal)
    @doc
      "Redeem AMOUNT of cTokens in exchange for the equivalent amount of the   \
      \underlying asset."

    @model [ (property (!= account "")) (property (> tokens 0.0)) ])

  (defun borrow:string (account:string guard:guard market:string amount:decimal)
    @doc
      "Borrow AMOUNT of the underlying asset for this market and send it to    \
      \ACCOUNT. Will fail if the account has insufficient collateral."

    @model [ (property (!= account "")) (property (> amount 0.0)) ])

  (defun repay:string (account:string market:string amount:decimal)
    @doc
      "Repay AMOUNT of the underlying asset. If you repay more than you        \
      \borrowed then the extra will be returned."

    @model [ (property (!= account "")) (property (> amount 0.0)) ])

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

    @model [ (property (authorized-by "free.charkha-admin-keyset")) ])
)
