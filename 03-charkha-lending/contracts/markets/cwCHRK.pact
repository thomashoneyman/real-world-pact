; The market for CHRK with the cwCHRK interest token. See the 'market-interface'
; contract for details. This is a fungible token so it implements fungible-v2.
(namespace "free")

(enforce-guard (keyset-ref-guard "free.charkha-admin-keyset"))

(module cwCHRK GOVERNANCE
  @doc "The Charkha token for the CHRK money market."

  (implements charkha-market-iface)
  (implements fungible-v2)

  ; ----------
  ; SCHEMA

  (defconst SYMBOL "CHRK")

  (deftable participants-table:{charkha-market-iface.participant})

  (defconst REF_KEY "ref")
  (defschema ref controller-ref:module{charkha-controller-iface})
  (deftable refs-table:{ref})

  ; ----------
  ; CAPABILITIES

  (defcap GOVERNANCE ()
    (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset")))

  (defcap ADMIN ()
    (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset")))

  (defcap TRANSFER:bool (sender:string receiver:string amount:decimal)
    @managed amount TRANSFER-mgr
    (enforce (!= sender receiver) "Sender cannot be the same as the receiver.")
    (enforce (!= sender "") "Sender cannot be empty.")
    (enforce (!= receiver "") "Receiver cannot be empty.")
    (enforce-unit amount) ; see (enforce-unit) later in this file for details.
    (enforce (> amount 0.0) "Transfer limit must be positive.")
    ; Here we enforce that the user has sufficient borrowing capacity that
    ; transferring AMOUNT will still leave them with some borrow capacity.
    (with-read refs-table REF_KEY { "controller-ref" := controller-ref:module{charkha-controller-iface} }
      (enforce
        (> (- (controller-ref::borrowing-capacity sender SYMBOL) amount) 0.0)
        "Insufficient borrowing capacity.")))

  ; Typical implementation of the manager function for the (TRANSFER) capability.
  (defun TRANSFER-mgr:decimal (managed:decimal requested:decimal)
    (let ((balance (- managed requested)))
      (enforce (>= balance 0.0) (format "TRANSFER exceeded for balance {}" [managed]))
      balance))

  ; ----------
  ; FUNCTIONS

  (defun init (controller-ref:module{charkha-controller-iface})
    (with-capability (ADMIN)
      (insert refs-table REF_KEY { "controller-ref": controller-ref })))

  (defun get-participant:object{charkha-market-iface.participant} (account:string)
    (read participants-table account))

  (defun get-borrow:decimal (account:string)
    (with-default-read participants-table account { "borrows": 0.0 } { "borrows" := borrow } borrow))

  (defun get-supply:decimal (account:string)
    (with-read refs-table REF_KEY { "controller-ref" := controller-ref:module{charkha-controller-iface} }
      (with-default-read participants-table account { "balance": 0.0 } { "balance" := balance }
        (floor (* balance (controller-ref::get-exchange-rate SYMBOL)) (precision)))))

  (defun accrue-interest:decimal (account:string)
    (enforce (!= account "") "Account cannot be empty.")
    (with-default-read participants-table account
      { "borrows": 0.0
      , "last-updated": (at 'block-height (chain-data))
      , "last-rate-index": 1.0 ; this value will never be used because we do not accrue when (= 0 borrows)
      }
      { "borrows" := borrows
      , "last-updated" := last-updated
      , "last-rate-index" := last-rate-index
      }
      (if (or (= last-updated (at 'block-height (chain-data))) (= 0.0 borrows))
        borrows
        (with-read refs-table REF_KEY { "controller-ref" := controller-ref:module{charkha-controller-iface} }
          (let*
            (
              (current-rate-index:decimal (controller-ref::get-interest-rate-index SYMBOL))
              (new-borrows:decimal (floor (* borrows (/ current-rate-index last-rate-index)) (precision)))
            )
            (update participants-table account
              { "borrows": new-borrows
              , "last-updated": (at 'block-height (chain-data))
              , "last-rate-index": current-rate-index
              })
            new-borrows)))))

  (defun apply-balance-change:string (account:string guard:guard)
    (with-read refs-table REF_KEY { "controller-ref" := controller-ref:module{charkha-controller-iface} }
      (let*
        (
          (balance-change (controller-ref::get-pending-balance-change account SYMBOL))
          (supply-change:decimal (at 'supply balance-change))
          (borrow-change:decimal (at 'borrow balance-change))
        )
        (with-default-read participants-table account
          { "last-updated": (at 'block-height (chain-data))
          , "last-rate-index": (controller-ref::get-interest-rate-index SYMBOL)
          , "balance": 0.0
          , "borrows": 0.0
          , "guard": guard
          }
          { "last-updated" := last-updated
          , "last-rate-index" := last-rate-index
          , "balance" := balance
          , "borrows" := borrows
          , "guard" := existing-guard
          }
          (enforce (= existing-guard guard) "Guards must match.")
          (write participants-table account
            { "last-updated": last-updated
            , "last-rate-index": last-rate-index
            , "balance": (if (= supply-change 0.0) balance (+ balance (/ supply-change (controller-ref::get-exchange-rate SYMBOL))))
            , "borrows": (+ borrow-change borrows)
            , "guard": guard
            })))))

  ; Typical implementation of the (transfer) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L41-L53
  (defun transfer:string (sender:string receiver:string amount:decimal)
    (with-capability (TRANSFER sender receiver amount)
      (with-read participants-table sender { "balance" := balance }
        (enforce (<= amount balance) "Insufficient funds.")
        (update participants-table sender { "balance": (- balance amount) }))

      (with-read participants-table receiver { "balance" := balance }
        (update participants-table receiver { "balance": (+ balance amount) }))))

  ; Typical implementation of the (transfer-create) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L41-L53
  (defun transfer-create:string (sender:string receiver:string receiver-guard:guard amount:decimal)
    (with-capability (TRANSFER sender receiver amount)
      (with-read participants-table sender { "balance" := balance }
        (enforce (<= amount balance) "Insufficient funds.")
        (update participants-table sender { "balance": (- balance amount) }))

      (with-read refs-table REF_KEY { "controller-ref" := controller-ref:module{charkha-controller-iface} }
        (with-default-read participants-table receiver
          { "last-updated": (at 'block-height (chain-data))
          , "last-rate-index": (controller-ref::get-interest-rate-index SYMBOL)
          , "balance": 0.0
          , "borrows": 0.0
          , "guard": receiver-guard
          }
          { "last-updated" := last-updated
          , "last-rate-index" := last-rate-index
          , "balance" := balance
          , "borrows" := borrows
          , "guard" := existing-guard
          }
          (enforce (= receiver-guard existing-guard) "Supplied receiver guard must match existing guard.")
          (write participants-table receiver
            { "last-updated": last-updated
            , "last-rate-index": last-rate-index
            , "balance": (+ balance amount)
            , "borrows": borrows
            , "guard": receiver-guard
            })))))

  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L73-L95
  (defpact transfer-crosschain:string (sender:string receiver:string receiver-guard:guard target-chain:string amount:decimal)
    (step (format "{}" [(enforce false "Cross-chain transfers not supported for cwCHRK.")])))

  ; Typical implementation of the (get-balance) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L97-L100
  (defun get-balance:decimal (account:string)
    (with-read participants-table account { "balance" := balance }
      balance))

  ; Typical implementation of the (details) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L102-L106
  (defun details:object{fungible-v2.account-details} (account:string)
    (with-read participants-table account
      { "balance" := balance, "guard" := guard }
      { "account": account, "balance": balance, "guard": guard }))

  ; The standard precision used by all Charkha contracts, as required by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L108-L111
  (defun precision:integer ()
    13)

  ; Typical implementation of the (enforce-unit) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L113-L116
  (defun enforce-unit:bool (amount:decimal)
    (enforce (= amount (floor amount 13)) "Amounts cannot exceed 13 decimal places."))

  ; Typical implementation of the (create-account) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L118-L123
  (defun create-account:string (account:string guard:guard)
    (enforce-guard guard)
    (with-read refs-table REF_KEY { "controller-ref" := controller-ref:module{charkha-controller-iface} }
      (insert participants-table account
        { "balance": 0.0
        , "borrows": 0.0
        , "guard": guard
        , "last-updated": (at 'block-height (chain-data))
        , "last-rate-index": (controller-ref::get-interest-rate-index SYMBOL)
        })))

  ; Typical implementation of the (rotate) function specified by fungible-v2.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L125-L131
  (defun rotate:string (account:string new-guard:guard)
    (with-read participants-table account { "guard" := old-guard }
      (enforce-guard old-guard)
      (update participants-table account { "guard": new-guard })))
)

(if (read-msg "init")
  [ (create-table free.cwCHRK.participants-table)
    (create-table free.cwCHRK.refs-table)
  ]
  "Upgrade complete")
