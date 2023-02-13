(namespace "free")

(enforce-guard (keyset-ref-guard "free.charkha-admin-keyset"))

(module charkha-controller GOVERNANCE
  @doc
    "The Charkha controlling contract. Used to maintain data about overall     \
    \markets and control access to sensitive operations."

  (implements charkha-controller-iface)

  ; There are 525,960 minutes in a year. Chainweb processes a block on a chain
  ; every 30 seconds. Therefore there are about 1,051,920 blocks per year.
  (defconst BLOCKS_PER_YEAR 1051920.0)

  ; ----------
  ; SCHEMA

  ; First we'll store individual market states in the markets table.
  (deftable markets-table:{charkha-controller-iface.market-state})

  ; Using the 'keys' function is quite expensive. For example, to get the market
  ; count via (length (keys markets-table)) costs about 40_000 units of gas,
  ; even with just 1 market! To read the market count from this market-summary
  ; table, in contrast, costs only ~20 units of gas. Thus it is useful to cache
  ; data in tables even if technically you could compute it from available
  ; sources. The downside: you have to remember to keep the cached data in sync.
  (defschema market-summary
    @doc "A summary row of market data, used to minimize gas costs for reading data"
    market-count:integer
    market-names:[string])

  (defconst MARKET_SUMMARY_KEY "market-summary")
  (deftable market-summary-table:{market-summary})

  (deftable balance-change-table:{charkha-controller-iface.balance-change})

  ; ----------
  ; CAPABILITIES

  (defcap GOVERNANCE ()
    (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset")))

  (defcap ADMIN:bool ()
    (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset")))

  (defcap INTERNAL () true)

  ; This capability is used as the guard for the "charkha" account instead of
  ; the more typical keyset guard you see on most user accounts. Using a
  ; capability user guard for the "charkha" account in the coin, KETH, and CHRK
  ; tokens allows us to transfer funds for the account by granting the TREASURY
  ; capability, which means that transfers can occur without signatures. This is
  ; critical so that functions like (borrow) can be called by protocol users
  ; with no admin intervention.
  (defcap TREASURY () true)

  ; The predicate function for our user guard. We aren't allowed to call
  ; (create-user-guard (require-capability (X))) directly; we need to put the
  ; (require-capability) into its own function.
  (defun require-TREASURY ()
    (require-capability (TREASURY)))

  (defcap BORROW (account:string market:string amount:decimal)
    (enforce (!= account "") "Account cannot be empty")
    (enforce (> amount 0.0) "Amount must be positive.")
    ; This weird little trick (saving the borrowing-capacity to a let binding
    ; before enforcing) is because the (enforce) function does not allow
    ; you to do database reads. Only pure code allowed.
    (let
      (
        (capacity (borrowing-capacity account market))
      )
      (with-read markets-table market
        { "total-supply" := total-supply
        , "total-borrows" := total-borrows
        , "token-ref" := token-ref:module{fungible-v2}
        }
        (enforce (< amount capacity) "Insufficient borrowing capacity.")
        (enforce (< amount (- total-supply total-borrows)) "Insufficient market capacity."))))

  ; ----------
  ; FUNCTIONS

  (defun register-market:string
    ( market:string
      token-ref:module{fungible-v2}
      market-ref:module{charkha-market-iface}
    )
    (with-capability (ADMIN)
      ; We don't need to enforce the market has not already been registered
      ; because (insert) will fail on key collision.
      (insert markets-table market
        { "total-borrows": 0.0
        , "total-supply": 0.0
        , "total-reserves": 0.0
        , "last-updated": (at 'block-height (chain-data))
        , "interest-rate-index": 1.0 ; The white paper specifies the index begins at 1
        , "exchange-rate": 50.0 ; The white paper specifies the rate begins at 50:1
        , "reward-share": 0.0
        , "market-ref": market-ref
        , "token-ref": token-ref
        })

      ; Once registered, we can initialize governance for the market, which sets
      ; the base rates, etc. for the market subject to change by the community.
      ;
      ; We'll initialize markets to the same values used in the Charkha white
      ; paper examples so it's easier to verify.
      (free.charkha-governance.init-market market
        { "base-rate": 0.025 ; we'll start with a 2.5% minimum rate
        , "reserve-factor": 0.01 ; we'll hold back 1% of borrower interest for platform reserves
        , "multiplier": 0.2 ; we'll increase interest rates wrt utilization at 20%
        , "collateral-ratio": 0.8 ; we'll let you borrow up to 80% of your collateral
        })

      ; We need to create an account for the lending protocol so it can accept
      ; and send funds from the underlying token contract. We'll use "charkha"
      ; as the account name for legibility, but on Chainweb it ought to be a
      ; k:account. In addition, we will guard the account with our TREASURY
      ; capability instead of a keyset, which in practice means that code in
      ; this module can act as this account, and code outside this module
      ; cannot (except via a module reference).
      (with-capability (TREASURY)
        (token-ref::create-account "charkha" (create-user-guard (require-TREASURY))))

      ; Any time we adjust the available markets we need to update the summary
      ; table we use for caching also.
      (with-read market-summary-table MARKET_SUMMARY_KEY
        { "market-count" := market-count, "market-names" := market-names }
        (update market-summary-table MARKET_SUMMARY_KEY
          { "market-count": (+ 1 market-count)
          , "market-names": (+ [market] market-names)
          }))))

  (defun get-market-count:integer ()
    (with-read market-summary-table MARKET_SUMMARY_KEY { "market-count" := market-count } market-count))

  (defun get-market-names:[string] ()
    (with-read market-summary-table MARKET_SUMMARY_KEY { "market-names" := market-names } market-names))

  (defun get-market:object{charkha-controller-iface.market-state} (market:string)
    (read markets-table market))

  (defun get-interest-rate-index:decimal (market:string)
    (at 'interest-rate-index (read markets-table market)))

  (defun get-exchange-rate:decimal (market:string)
    (at 'exchange-rate (read markets-table market)))

  (defun get-pending-balance-change:object{charkha-controller-iface.balance-change} (account:string market:string)
    (let ((row (read balance-change-table account)))
      (enforce (= market (at 'market row)) "No pending balance for the given market.")
      row))

  ; A user's borrowing capacity is the sum of their holdings in each market,
  ; where for each market we multipy their holdings against their collateral
  ; ratio in that market.
  (defun borrowing-capacity:decimal (account:string denomination:string)
    (floor (/ (borrowing-capacity-usd account) (free.charkha-oracle.get-price denomination)) (coin.precision)))

  (defun borrowing-capacity-usd:decimal (account:string)
    @doc
      "A user's borrowing capacity across all markets in USD. A negative       \
      \borrowing capacity indicates the account is eligible for liquidation."

    (with-read market-summary-table MARKET_SUMMARY_KEY { "market-names" := market-names }
      (fold (+) 0.0 (map (borrowing-capacity-usd-market account) market-names))))

  (defun borrowing-capacity-usd-market:decimal (account:string market:string)
    @doc
      "A user's borrowing capacity in a single market denominated in USD. A    \
      \helper function used to implement (borrowing-capacity)."

    (with-read markets-table market
      { "market-ref" := market-ref:module{charkha-market-iface}
      , "exchange-rate" := exchange-rate:decimal
      }
      (let
        (
          (oracle-price:decimal (free.charkha-oracle.get-price market))
          (collateral-ratio:decimal (at 'collateral-ratio (free.charkha-governance.get-market-factors market)))
          (user-borrows:decimal (market-ref::accrue-interest account) )
          (user-supply:decimal (market-ref::get-supply account))
        )
        (* oracle-price (- (* collateral-ratio user-supply) user-borrows)))))

  ; To check an account's liquidation eligibility in a given market, we look at
  ; their total borrowing capacity. If it is negative, then the user has
  ; exceeded their borrowing capacity. They can be liquidated for the amount
  ; they have exceeded their capacity, plus an additional 25%.
  ;
  ; We then look at their assets in the given market. The user can be liquidated
  ; for as many assets as they have in the market up to their liquidation total.
  ; The returned value of this function is the amount of the underlying asset
  ; that can be send by the liquidator to receive that amount of cTokens at a
  ; 5% discount.
  (defun liquidation-eligible:decimal (account:string market:string)
    (let ( (capacity:decimal (borrowing-capacity account market)) )
      (if (> capacity 0.0) 0.0
        (with-read markets-table market { "market-ref" := market-ref:module{charkha-market-iface} }
          (let
            (
              (supply:decimal (market-ref::get-supply account))
              (eligible:decimal (* 1.25 (abs capacity)))
            )
            (* 0.95 (if (> eligible supply) supply eligible)))))))

  ; To calculate market participation, we take the following steps on each
  ; market in the protocol:
  ;
  ;   1. We get the user details, if they exist
  ;   2. We calculate their total supply / borrow by applying the interest rate
  ;      and exchange rate.
  ;   3. We get the market total supply / borrow
  ;   4. We multiply (user total / market total * reward share)
  ;
  ; The sum of the user's participation in every market is their total
  ; participation.
  (defun market-participation:decimal (account:string)
    (with-capability (INTERNAL)
      (with-read market-summary-table MARKET_SUMMARY_KEY
        { "market-names" := market-names }
        (fold (+) 0.0 (map (single-market-participation account) market-names)))))

  (defun single-market-participation:decimal (account:string market:string)
    @doc "A helper function for use in calculating market participation. Internal-only."
    (require-capability (INTERNAL))
    (with-read markets-table market
      { "market-ref" := market-ref:module{charkha-market-iface}
      , "exchange-rate" := exchange-rate:decimal
      , "reward-share" := reward-share:decimal
      , "total-borrows" := total-borrows:decimal
      , "total-supply" := total-supply:decimal
      }
      (let
        (
          (user-total (+ (market-ref::accrue-interest account) (market-ref::get-supply account)))
          (market-total (+ total-borrows total-supply))
        )
        (if (= 0.0 user-total) 0.0
          (floor (* reward-share (/ user-total market-total)) (coin.precision))))))

  (defun get-utilization:decimal (market:string)
    (with-read markets-table market { "total-borrows" := total-borrows, "total-supply" := total-supply }
      (if (= 0.0 total-borrows) 0.0 (floor (/ total-borrows total-supply) (coin.precision)))))

  (defun get-borrow-interest-rate:decimal (market:string)
    (bind (free.charkha-governance.get-market-factors market) { "base-rate" := base-rate, "multiplier" := multiplier }
      (floor (+ base-rate (* (get-utilization market) multiplier)) (coin.precision))))

  (defun get-supply-interest-rate:decimal (market:string)
    (let
      (
        (utilization:decimal (get-utilization market))
        (borrow-interest-rate:decimal (get-borrow-interest-rate market))
        (reserve-factor:decimal (at 'reserve-factor (free.charkha-governance.get-market-factors market)))
      )
      (floor (* borrow-interest-rate (* utilization (- 1 reserve-factor))) (coin.precision))))

  (defun supply:string (account:string market:string amount:decimal)
    ; When a user supplies funds to the protocol, we tell the associated market
    ; contract to credit their account with the equivalent cTokens. A user
    ; should be able to supply funds without a Charkha admin signature, so this
    ; credit function must be called without signatures. But if the credit
    ; function is called without signatures we don't want users to be able to
    ; supply an arbitrary amount. So we store the credit amount here in the
    ; controller account, and then tell the market contract to credit the funds,
    ; at which point it looks up the funding amount from the controlling
    ; contract. It's a bit circular but it gets the job done!
    (with-capability (INTERNAL) (sync-protocol))
    (with-read markets-table market
      { "total-supply" := total-supply
      , "exchange-rate" := exchange-rate
      , "token-ref" := token-ref:module{fungible-v2}
      , "market-ref" := market-ref:module{charkha-market-iface}
      }
      ; We attempt to transfer funds from the user account to the protocol
      (token-ref::transfer account "charkha" amount)
      ; If the transfer succeeds, then we record the amount supplied.
      (write balance-change-table account { "market": market, "supply": amount, "borrow": 0.0 })
      ; Then we tell market to update the allocation for the account in question
      ; (ie. credit the account with its funds).
      (market-ref::apply-balance-change account (at 'guard (token-ref::details account)))
      ; Then we reset the allocation to 0.0 so any further calls to
      ; (apply-balance-change) have no effect.
      (update balance-change-table account { "borrow": 0.0, "supply": 0.0 })
      ; We can then update our market cache to reflect the new total supply.
      (update markets-table market { "total-supply": (+ amount total-supply) })))

  (defun redeem:string (account:string market:string tokens:decimal)
    (enforce (> tokens 0.0) "Redeem amount must be greater than zero.")
    (with-capability (INTERNAL) (sync-protocol))
    (with-read markets-table market
      { "total-supply" := total-supply
      , "exchange-rate" := exchange-rate
      , "token-ref" := token-ref:module{fungible-v2}
      , "market-ref" := market-ref:module{charkha-market-iface}
      }
      (let
        (
          (asset-amount:decimal (floor (* tokens exchange-rate) (coin.precision)))
          (user-borrow-capacity:decimal (borrowing-capacity account market))
          (user-balance-asset:decimal (market-ref::get-supply account))
        )
        ; First we make sure that you are not redeeming tokens that are
        ; necessary to maintain your collateral levels.
        (enforce (>= user-balance-asset asset-amount) "Redeem amount exceeds balance.")
        (enforce (> (- user-borrow-capacity asset-amount) 0.0) "Redeem amount would drop collateral below acceptable levels.")
        (enforce (>= total-supply asset-amount) "Redeem amount exceeds market supply.")

        ; Then we the tell market to update the the account in question (ie.
        ; reduce the account's supply).
        (write balance-change-table account { "market": market, "borrow": 0.0, "supply": (- 0.0 asset-amount) })
        (market-ref::apply-balance-change account (at 'guard (token-ref::details account)))
        (update balance-change-table account { "borrow": 0.0, "supply": 0.0 })

        ; If everything so far has succeeded we can process the user redemption.
        (with-capability (TREASURY)
          (install-capability (token-ref::TRANSFER "charkha" account asset-amount))
          (token-ref::transfer "charkha" account asset-amount))

        ; And we can then update our market cache to reflect the new total supply.
        (update markets-table market { "total-supply": (- total-supply asset-amount) })
        "Redeem completed")))

  (defun borrow:string (account:string guard:guard market:string amount:decimal)
    ; As with supplying funds, we allow users to borrow funds from the protocol
    ; without a Charkha admin signature. We'll use the same back-and-forth with
    ; the market contract to make this possible. There's one big difference:
    ; you can always supply funds, but you can only borrow funds if you have
    ; sufficient borrowing capacity.
    (with-capability (BORROW account market amount)
      ; We always begin a protocol interaction with a sync.
      (with-capability (INTERNAL) (sync-protocol))
      (with-read markets-table market
        { "total-borrows" := total-borrows
        , "market-ref" := market-ref:module{charkha-market-iface}
        , "token-ref" := token-ref:module{fungible-v2}
        }
        ; With enforcement handled by the (BORROW) capability we can tell the
        ; market to increase the account's borrows.
        (write balance-change-table account { "market": market, "borrow": amount, "supply": 0.0 })
        (market-ref::apply-balance-change account guard)
        (update balance-change-table account { "borrow": 0.0, "supply": 0.0 })

        ; If everything so far has succeeded we can process the user's borrow.
        (with-capability (TREASURY)
          (install-capability (token-ref::TRANSFER "charkha" account amount))
          (token-ref::transfer-create "charkha" account guard amount))

        ; And we can then update our market cache to reflect the new total borrows.
        (update markets-table market { "total-borrows": (+ amount total-borrows) })
        "Completed borrow.")))

  (defun repay:string (account:string market:string amount:decimal)
    (enforce (!= account "") "Account cannot be empty.")
    (enforce (> amount 0.0) "Repay amount must be greater than zero.")
    (with-capability (INTERNAL) (sync-protocol))
    (with-read markets-table market
      { "total-borrows" := total-borrows
      , "market-ref" := market-ref:module{charkha-market-iface}
      , "token-ref" := token-ref:module{fungible-v2}
      }
      (let ((user-borrow-asset:decimal (market-ref::get-borrow account)))
        ; First we make sure that you are not redeeming tokens that are
        ; necessary to maintain your collateral levels.
        (enforce (>= user-borrow-asset amount) "Repayment amount exceeds balance.")

        ; Then we the tell the market to update the account in question
        (write balance-change-table account { "market": market, "borrow": (- 0.0 amount), "supply": 0.0 })
        (market-ref::apply-balance-change account (at 'guard (token-ref::details account)))
        (update balance-change-table account { "borrow": 0.0, "supply": 0.0 })

        ; If everything so far has succeeded we can process the user's repayment.
        (token-ref::transfer account "charkha" amount)

        ; And we can then update our market cache to reflect the new total borrows.
        (update markets-table market { "total-borrows": (- amount total-borrows) })
        "Completed repayment.")))

  ; In liquidation, a liquidator pays back a portion of a user's loan and
  ; receives their collateral in exchange. They are incentivized to do this
  ; because they purchase the collateral at a 5% discount vs. the exchange rate.
  (defun liquidate:string (liquidator:string account:string market:string amount:decimal)
    (enforce (!= liquidator "") "Liquidator cannot be empty.")
    (enforce (!= account "") "Account cannot be empty.")
    (enforce (> amount 0.0) "Liquidate amount must be greater than zero.")
    (with-capability (INTERNAL) (sync-protocol))
    (with-read markets-table market
      { "total-supply" := total-supply
      , "total-borrows" := total-borrows
      , "exchange-rate" := exchange-rate
      , "market-ref" := market-ref:module{charkha-market-iface}
      , "token-ref" := token-ref:module{fungible-v2}
      }
      (let*
        (
          (eligible-amount:decimal (liquidation-eligible account market))
          (discounted-amount:decimal (* amount 0.95))
        )
        (enforce (<= amount eligible-amount)
          "Liquidation amount greater than account can be liquidated for in this market.")

        ; First, we'll transfer from the liquidator account to the protocol at
        ; a discounted amount and reward them with the full amount of cTokens.
        (token-ref::transfer liquidator "charkha" discounted-amount)
        (write balance-change-table liquidator { "market": market, "borrow": 0.0, "supply": amount })
        (market-ref::apply-balance-change liquidator (at 'guard (token-ref::details liquidator)))
        (update balance-change-table liquidator { "borrow": 0.0, "supply": 0.0 })

        ; If this works, then we reduce the liquidated account's supply by the
        ; same amount.
        (write balance-change-table account { "market": market, "borrow": 0.0, "supply": (- 0.0 amount) })
        (market-ref::apply-balance-change account (at 'guard (token-ref::details account)))
        (update balance-change-table account { "borrow": 0.0, "supply": 0.0 })

        ; Then, we walk through the markets the liquidated account participates
        ; in to reduce their borrow balances, until we've exhausted the repaid
        ; amount. We only reduce the borrows by the amount the liquidator paid.
        (with-capability (INTERNAL)
          (let ((liquidation-remaining:decimal (fold (liquidate-one account) discounted-amount (get-market-names))))
            ; Once liquidation has completed, we verify that we did indeed reduce
            ; borrows by the full liquidated amount.
            (enforce (= 0.0 liquidation-remaining) "Unable to liquidate account for full amount.")))

        "Completed liquidation.")))

  ; This helper function should be used with a (fold) to repay borrows in markets
  ; one-by-one until the amount a user was liquidated for has been fully applied
  ; to their borrow balances.
  (defun liquidate-one:decimal (account:string remaining-liquidation:decimal market:string)
    (require-capability (INTERNAL))
    (if (= 0.0 remaining-liquidation) remaining-liquidation
      (with-read markets-table market
        { "market-ref" := market-ref:module{charkha-market-iface}
        , "token-ref" := token-ref:module{fungible-v2}
        , "total-borrows" := total-borrows
        }
        (let ((borrow:decimal (market-ref::get-borrow account)))
          ; If the user has a borrow in this market then it can be liquidated up
          ; to the remaining liquidation amount. If they don't, then we move to
          ; the next market.
          (if (= borrow 0.0) remaining-liquidation
            ; If the user's borrow is greater than the liquidation amount, then
            ; we reduce the borrow by the liquidation amount and complete the
            ; process. If it is less, then we close out their borrow and move on
            ; to the next market with the remainder.
            (let ((reduction:decimal (if (> borrow remaining-liquidation) remaining-liquidation borrow)))
              (write balance-change-table account { "market": market, "borrow": (- 0.0 reduction), "supply": 0.0 })
              (market-ref::apply-balance-change account (at 'guard (token-ref::details account)))
              (update balance-change-table account { "borrow": 0.0, "supply": 0.0 })
              (update markets-table market { "total-borrows": (- total-borrows reduction) })
              ; After updating the user's borrows, we continue to the next market
              ; with the remainder (if there is any), or 0.0 if we repaid the
              ; full borrow amount.
              (- remaining-liquidation reduction)))))))

  (defun sync-protocol:string ()
    @doc
      "Synchronizes the protocol by compounding interest, updating exchange    \
      \rates, and accruing CHRK rewards. Should be run on every protocol       \
      \interaction, e.g. on lend, borrow, redeem, repay, liquidate."

    (with-capability (INTERNAL)
      (let ((market-total:decimal (fold (+) 0.0 (map (sync-market-interest) (get-market-names)))))
      (map (sync-market-reward-share market-total) (get-market-names))
      "Synced protocol.")))

  (defun sync-market-reward-share:string (overall:decimal market:string)
    @doc
      "An internal-only helper function to sync the reward share of the various\
      \markets in the protocol. Should only ever be used after compounding the \
      \market interest."

    (require-capability (INTERNAL))
    (with-read markets-table market { "total-supply" := total-supply, "total-borrows" := total-borrows }
      (update markets-table market
        ; The rewards share is this market's share of the overall market activity.
        { "reward-share":
            (if (= (+ total-supply total-borrows) 0.0) 0.0
              (floor (/ (* (free.charkha-oracle.get-price market) (+ total-supply total-borrows)) overall) (coin.precision)))
        })))

  (defun sync-market-interest:decimal (market:string)
    @doc
      "An internal-only helper function to synchronize a single market in the  \
      \protocol. Returns the total borrows and supply of the market denominated\
      \in USD."

    (require-capability (INTERNAL))
    (with-read markets-table market
      { "total-borrows" := total-borrows
      , "total-supply" := total-supply
      , "total-reserves" := total-reserves
      , "exchange-rate" := exchange-rate
      , "interest-rate-index" := interest-rate-index
      , "last-updated" := last-updated
      }
      (if (= last-updated (at 'block-height (chain-data)))
        (* (free.charkha-oracle.get-price market) (+ total-borrows total-supply))
        (bind (free.charkha-governance.get-market-factors market)
          { "base-rate" := base-rate:decimal
          , "multiplier" := multiplier:decimal
          , "reserve-factor" := reserve-factor:decimal
          }
          ; For the reason for each variable below and the formula used to calculate
          ; it, please see the Charkha white paper and examples.
          (let*
            (
              (utilization:decimal (get-utilization market))
              (borrow-interest-rate:decimal (get-borrow-interest-rate market))
              (supply-interest-rate:decimal (get-supply-interest-rate market))
              (blocks-elapsed:integer (- (at 'block-height (chain-data)) last-updated))
              (apr-share:decimal (/ blocks-elapsed BLOCKS_PER_YEAR))

              (new-interest-index:decimal (floor (* interest-rate-index (+ 1 (* borrow-interest-rate apr-share))) (coin.precision)))
              (new-borrows:decimal (floor (* total-borrows new-interest-index) (coin.precision)))
              (new-reserves:decimal (floor (+ total-reserves (* total-borrows (* reserve-factor (* borrow-interest-rate apr-share)))) (coin.precision)))
              (new-exchange-rate:decimal (floor (* exchange-rate (+ 1 (* supply-interest-rate apr-share))) (coin.precision)))
            )
            (if (= 0.0 utilization)
              ; If there are no borrowers then no interest accrues (who would pay?)
              (let ((_ "Pact doesn't allow heterogeneous lists in (if) statements for some reason, so this dummy let is a workaround."))
                (update markets-table market { "last-updated": (at 'block-height (chain-data)) })
                (* (free.charkha-oracle.get-price market) (+ total-borrows total-supply)))
              ; Otherwise we can compound the interest and update the protocol values.
              (let ((_ 0))
                (enforce (>= utilization 0.0) "Utilization must be non-negative")
                (enforce (> borrow-interest-rate 0.0) "Borrow interest rate must be positive")
                (enforce (>= supply-interest-rate 0.0) "Supply interest rate must be non-negative")
                (enforce (> new-exchange-rate exchange-rate) "Exchange rate must increase.")
                (enforce (> new-interest-index interest-rate-index) "Interest rate index must increase.")
                (update markets-table market
                  { "total-borrows": new-borrows
                  , "total-reserves": new-reserves
                  , "exchange-rate": new-exchange-rate
                  , "interest-rate-index": new-interest-index
                  , "last-updated": (at 'block-height (chain-data))
                  })
                (* (free.charkha-oracle.get-price market) (+ new-borrows total-supply)))))))))

)

(if (read-msg "init")
  [ (create-table free.charkha-controller.markets-table)
    (create-table free.charkha-controller.market-summary-table)
    (create-table free.charkha-controller.balance-change-table)
    (insert free.charkha-controller.market-summary-table MARKET_SUMMARY_KEY { "market-count": 0, "market-names": [] })
  ]
  "Upgrade complete")
