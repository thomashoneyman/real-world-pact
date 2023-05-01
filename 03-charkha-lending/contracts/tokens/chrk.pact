; The CHRK token is the governance and rewards token for Charkha. As described
; in the white paper, this token is a standard KIP-0005 token with some unique
; properties we'll encode in this contract:
;
; - 1 CHRK accrues per market per block
; - The maximum supply of CHRK is 10 million, after which distribution stops
; - CHRK can be claimed by users dependent on their market participation
;
; CHRK is much more than a simple fungible token. To implement these extra
; properties we are going to need to refer to data in our other contracts,
; such as an account's collateral (as recorded in the Charkha controlling
; contract). However, our other contracts also refer to CHRK, since it is itself
; one of our lending markets.
;
; In this module we will implement the CHRK token and use _module references_
; to refer to the interfaces of the other contracts we rely on. Comments will
; focus on the unique properties of CHRK aside from its use as a fungible
; token; for a full set of comments and tests focused on the fungible-v2
; interface please see the KETH contract and REPL tests.
(namespace "free")

(enforce-guard (keyset-ref-guard "free.charkha-admin-keyset"))

(module CHRK GOVERNANCE
  @doc "CHRK is the governance and rewards token for Charkha."

  ; This is a KIP-0005 token, so it must implement the fungible-v2 interface.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact
  (implements fungible-v2)

  ; ----------
  ; CONSTANTS

  ; The Charkha white paper specifies that the maximum supply of CHRK is 10 million.
  (defconst MAX_SUPPLY 10000000)

  ; ----------
  ; SCHEMAS

  ; We won't use the account-details schema from fungible-v2 for our table:
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L8-L13
  ;
  ; ...because we need to add more fields to it. We'll still be responsible for
  ; returning this schema from the (details) function, though, so we need to at
  ; least satisfy the required fields.
  (defschema account
    @doc "Schema for CHRK account holders."
    last-claimed:integer ; block height
    balance:decimal
    guard:guard)

  (deftable accounts:{account})

  ; The accruals table records the total CHRK that has accrued since the token
  ; launched. This represents the amount of CHRK that can be claimed.
  (defconst ACCRUALS_KEY "accruals")

  (defschema accruals-schema
    @doc "Schema for CHRK accrual that can be snapshotted by (accrue)"
    accrued:integer
    last-accrued:integer)

  (deftable accruals:{accruals-schema})

  ; The reference table stores a reference to the Charkha controlling contract.
  ; The administrator can register the controlling module. Once registered it
  ; cannot be changed.
  (defconst REF_KEY "ref")

  (defschema ref
    @doc "Schema for a reference to the Charkha controlling module."
    initialized:bool
    controller-ref:module{charkha-controller-iface})

  (deftable refs:{ref})

  ; ----------
  ; CAPABILITIES

  (defcap GOVERNANCE ()
    (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset")))

  (defcap ADMIN ()
    (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset")))

  (defcap INTERNAL () true)

  ; Typical implementation of the (TRANSFER) capability specified by fungible-v2,
  (defcap TRANSFER:bool (sender:string receiver:string amount:decimal)
    @managed amount TRANSFER-mgr
    (enforce (!= sender receiver) "Sender cannot be the same as the receiver.")
    (enforce (!= sender "") "Sender cannot be empty.")
    (enforce (!= receiver "") "Receiver cannot be empty.")
    (enforce-unit amount)
    (enforce-guard (at 'guard (read accounts sender)))
    (enforce (> amount 0.0) "Transfer limit must be positive."))

  ; Typical implementation of the manager function for the (TRANSFER) capability.
  (defun TRANSFER-mgr:decimal (managed:decimal requested:decimal)
    (let ((balance (- managed requested)))
      (enforce (>= balance 0.0) (format "TRANSFER exceeded for balance {}" [managed]))
      balance))

  ; ----------
  ; FUNCTIONS

  ; Admin-only function to initialize the accruals database. Should only be used
  ; in the (init) function to creat the contract. This can only be run once
  ; because of the calls to (insert).
  (defun init (controller-ref:module{charkha-controller-iface})
    (let ((initialized (is-initialized)))
      (enforce (not initialized) "Cannot initialize more than once."))
    (with-capability (ADMIN)
      (insert refs REF_KEY { "controller-ref": controller-ref, "initialized": true })
      (insert accruals ACCRUALS_KEY
        { "last-accrued": (at 'block-height (chain-data))
        , "accrued": 0
        })))

  (defun is-initialized:bool ()
    (with-default-read refs REF_KEY { "initialized": false } { "initialized" := initialized } initialized))

  ; The claim function lets you claim your accrued CHRK rewards. Your share of
  ; CHRK rewards depends on your share of overall market activity for each
  ; market you participate in, and that information must come from the
  ; controlling contract. You can claim all rewards that should have accrued to
  ; your account since the last time you claimed rewards.
  ;
  ; To help prevent abuse by users waiting a long time to claim their rewards,
  ; then taking out a huge borrow and claiming with their temporarily large
  ; position to be rewarded as though they'd held it for a long time, we allow
  ; the administrator to accrue funds on behalf of a user at any time. The
  ; controlling contract will use this to accrue for a user on borrow, lend,
  ; or liquidate activity.
  (defun claim (account:string)
    @doc
      "Claim the accrued CHRK for an account. Claims can be triggered by anyone\
      \and the supplied account receives their accrued CHRK. This is the only  \
      \way that CHRK can be minted. The admin randomly claims CHRK for accounts\
      \to prevent abuse."

    (with-read accounts account { "balance" := balance, "last-claimed" := last-claimed, "guard" := guard }
      (with-capability (INTERNAL) (claim-internal account balance last-claimed guard))))

  (defun claim-create (account:string guard:guard)
    @doc
      "Claim the accrued CHRK for an account, creating the account if it does  \
      \not exist."

    ; In short, we look up your total market share, multiply it by the blocks
    ; elapsed since your last claim, multiply it by the number of supported
    ; markets, and that's your reward.
    (with-default-read accounts account
      { "balance": 0.0, "last-claimed": (- (at 'block-height (chain-data)) 1), "guard": guard }
      { "balance" := balance, "last-claimed" := last-claimed, "guard" := existing-guard }
      (enforce (= guard existing-guard) "Guard must match existing account guard.")
      (with-capability (INTERNAL) (claim-internal account balance last-claimed guard))))

  ; We'll use this helper function to ensure both (claim) functions are in sync.
  ; It can only be called from within this module.
  (defun claim-internal (account:string balance:decimal last-claimed:integer guard:guard)
    @doc
      "An internal-only helper function for claiming the correct amount of CHRK\
      \to a user account."

    (require-capability (INTERNAL))
    (with-read refs REF_KEY { "controller-ref" := controller-ref:module{charkha-controller-iface} }
      (let
        ( (share:decimal (controller-ref::market-participation account))
          (blocks-elapsed:integer (- (at 'block-height (chain-data)) last-claimed))
        )
        (write accounts account
          { "balance": (+ balance (* (controller-ref::get-market-count) (* blocks-elapsed share)))
          , "last-claimed": (at 'block-height (chain-data))
          , "guard": guard
          }))))

  ; The (accrue) function is used to update the total amount of CHRK that can be
  ; claimed. It's updated on every protocol interaction so that we know when we
  ; have hit the max supply. Once the max supply is reached, no more CHRK can be
  ; claimed for activity beyond that block.
  (defun accrue:string ()
    @doc
      "Update the accrued CHRK, which is the maximum that can be claimed by    \
      \market participants. CHRK accrues at 1 CHRK per market per block. No    \
      \CHRK is minted during accrual; CHRK is only minted when users claim     \
      \their rewards with (claim)."

    (with-read accruals ACCRUALS_KEY { "last-accrued" := last-accrued, "accrued" := accrued }
      (if (>= accrued MAX_SUPPLY)
        "The maximum supply of CHRK has been reached."
        ; Our accrual should produce 1 CHRK per market per block elapsed since the
        ; last update. If the last update was the same block no CHRK will accrue.
        ; If we would accrue beyond the maximum then we just set the accrued to
        ; the max supply.
        (with-read refs REF_KEY { "controller-ref" := controller-ref:module{charkha-controller-iface} }
          (let*
            ( (block-height:integer (at 'block-height (chain-data)))
              (newly-accrued:integer (* (- block-height last-accrued) (controller-ref::get-market-count)))
              (total-accrued:integer (+ newly-accrued accrued))
            )
            (write accruals ACCRUALS_KEY
              { "last-accrued": block-height
              , "accrued": (if (> total-accrued MAX_SUPPLY) MAX_SUPPLY total-accrued)
              })
            (format "Accrued {} CHRK." [newly-accrued]))))))

  ; A function to report the total supply of CHRK that has accrued in the
  ; lifetime of the contract.
  (defun get-total-supply:integer ()
    @doc "Reports the total current supply of CHRK (includes unclaimed CHRK)."
    (with-read accruals ACCRUALS_KEY { "accrued" := accrued } accrued))

  ; Typical implementation of the (transfer) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L41-L53
  (defun transfer:string (sender:string receiver:string amount:decimal)
    (with-capability (TRANSFER sender receiver amount)
      (with-read accounts sender { "balance" := sender-balance }
        (enforce (<= amount sender-balance) "Insufficient funds.")
        (update accounts sender { "balance": (- sender-balance amount) }))
      (with-read accounts receiver { "balance" := receiver-balance }
        (update accounts receiver { "balance": (+ receiver-balance amount) }))))

  ; Typical implementation of the (transfer-create) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L41-L53
  (defun transfer-create:string (sender:string receiver:string receiver-guard:guard amount:decimal)
    @model [ (property (= 0.0 (column-delta accounts "balance"))) ]

    (with-capability (TRANSFER sender receiver amount)
      (with-read accounts sender { "balance" := sender-balance }
        (enforce (<= amount sender-balance) "Insufficient funds.")
        (update accounts sender { "balance": (- sender-balance amount) }))

      (with-default-read accounts receiver
        { "balance": 0.0, "guard": receiver-guard, "last-claimed": (- (at 'block-height (chain-data)) 1) }
        { "balance" := receiver-balance, "guard" := existing-guard, "last-claimed" := last-claimed }
        (enforce (= receiver-guard existing-guard) "Supplied receiver guard must match existing guard.")
        (write accounts receiver
          { "balance": (+ receiver-balance amount)
          , "guard": receiver-guard
          , "last-claimed": last-claimed
          }))))

  ; The fungible-v2 interface requires (transfer-crosschain), but we don't
  ; support crosschain transfers for CHRK.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L73-L95
  (defpact transfer-crosschain:string (sender:string receiver:string receiver-guard:guard target-chain:string amount:decimal)
    (step (format "{}" [(enforce false "Cross-chain transfers not supported for CHRK.")])))

  ; Typical implementation of the (get-balance) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L97-L100
  (defun get-balance:decimal (account:string)
    (enforce (!= account "") "Account name cannot be empty.")
    (with-read accounts account { "balance" := balance }
      balance))

  ; Typical implementation of the (details) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L102-L106
  (defun details:object{fungible-v2.account-details} (account:string)
    (enforce (!= account "") "Account name cannot be empty.")
    (with-read accounts account
      { "balance" := balance, "guard" := guard }
      { "account": account, "balance": balance, "guard": guard }))

  ; The standard precision used by all Charkha contracts, as required by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L108-L111
  (defun precision:integer ()
    13)

  ; Typical implementation of the (enforce-unit) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L113-L116
  (defun enforce-unit:bool (amount:decimal)
    (enforce (>= amount 0.0) "Unit  cannot be negative.")
    (enforce (= amount (floor amount 13)) "Amounts cannot exceed 13 decimal places."))

  ; Typical implementation of the (create-account) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L118-L123
  (defun create-account:string (account:string guard:guard)
    (enforce (!= account "") "Account name cannot be empty.")
    (enforce-guard guard)
    (insert accounts account
      { "last-claimed": (at 'block-height (chain-data))
      , "balance": 0.0
      , "guard": guard
      }))

  ; Typical implementation of the (rotate) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L125-L131
  (defun rotate:string (account:string new-guard:guard)
    (enforce (!= account "") "Account name cannot be empty.")
    (with-read accounts account { "guard" := old-guard }
      (enforce-guard old-guard)
      (update accounts account { "guard" : new-guard })))
)

(if (read-msg "init")
  [ (create-table free.CHRK.accounts)
    (create-table free.CHRK.accruals)
    (create-table free.CHRK.refs)
  ]
  "Upgrade complete")
