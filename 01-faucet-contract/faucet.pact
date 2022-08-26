(define-keyset "goliath-faucet-keyset" (read-keyset "goliath-faucet-keyset"))
(enforce-guard (keyset-ref-guard "goliath-faucet-keyset"))
(namespace "free")

; The Goliath faucet allows any Goliath wallet user to ask for KDA to get their
; new wallet started. Technically, the faucet is accessible to anyoneon
; Chainweb and they can call (request-funds) for themselves. However, transfers
; must be signed by the faucet account, so in practice only software that has
; access to the faucet account keys can request funds on behalf of its users,
; and that means the Goliath wallet software — or you, since I've committed the
; faucet account keys to the yaml/keys directory for you to use.
;
; Here's how the faucet contract works:
;
; 1. Any Goliath user can request funds from the faucet, with the faucet account
;    signing on their behalf.
; 2. By default, users can request up to 20.0 KDA per call to request-funds and
;    up to 100.0 KDA in total.
; 3. The faucet account can increase the per-request and per-account limits for
;    any account (but it cannot decrease them).
; 4. You can return funds to the Goliath faucet, which will credit against your
;    total account limit.
; 5. You can look up your account's per-account and per-request limits.
;
; The Goliath wallet UI will use this contract to implement a few features:
;
; 1. When you sign up, the wallet will request 20.0 KDA on your behalf.
; 2. Subsequently, you can use the "Request KDA" action to request more funds,
;    or the "Send KDA" action to return funds.
; 3. If you reach your limit, you can use the "Admin" action to act as the
;    faucet account and raise the limits for your account.
; 4. The wallet will display your current account limits using this contract.

(module goliath-faucet "goliath-faucet-keyset"
  (defconst FAUCET_ACCOUNT "goliath-faucet")
  (defconst DEFAULT_REQUEST_LIMIT 20.0)
  (defconst DEFAULT_ACCOUNT_LIMIT 100.0)

  (defschema accounts-schema
    funds-requested:decimal
    funds-returned:decimal
    request-limit:decimal
    account-limit:decimal)

  (deftable accounts:{accounts-schema})

  (defcap ADMIN ()
    "Enforce only faucet account can perform admin-only actions"
    (enforce-keyset "goliath-faucet-keyset"))

  (defcap RETURN_FUNDS (account:string amount:decimal)
    (with-read accounts account { "funds-requested" := requested, "funds-returned" := returned }
      (let ( (balance (- requested returned)) )
        (enforce (<= amount balance)
          (format "{} exceeds the amount this account can return to the faucet, which is {}." [ amount balance ]))))
  )

  (defcap REQUEST_FUNDS (receiver:string amount:decimal)
    "Enforce only valid accounts can request funds."
    (enforce (!= "" receiver) "Receiver cannot be empty")
    (enforce (> amount 0.0) "Amount must be greater than 0.0")
    (with-default-read accounts receiver
      { "funds-requested": 0.0
      , "funds-returned": 0.0
      , "request-limit": DEFAULT_REQUEST_LIMIT
      , "account-limit": DEFAULT_ACCOUNT_LIMIT
      }
      { "funds-requested" := requested
      , "funds-returned" := returned
      , "request-limit" := request-limit
      , "account-limit" := account-limit
      }
      (let ((balance (- requested returned)) (total-requested (+ amount requested)))
        (enforce (<= amount request-limit)
          (format "{} exceeds the account's per-request limit, which is {}" [ amount request-limit ]))
        (enforce (<= (+ amount balance) account-limit)
          (format "{} would exceed the account's total limit ({} remains of {} total)" [ amount (- account-limit balance) account-limit]))))
  )

  (defun get-limits:object (account:string)
    (with-read accounts account { "account-limit" := account-limit, "request-limit" := request-limit, "funds-requested" := requested, "funds-returned" := returned }
      { "account-limit": account-limit
      , "request-limit": request-limit
      , "account-limit-remaining": (- account-limit (- requested returned))
      }
    ))

  (defun set-request-limit:string (account:string new-limit:decimal)
    (with-capability (ADMIN)
      (with-read accounts account { "request-limit" := old-request-limit }
        (enforce (> new-limit old-request-limit)
          (format "The new request limit {} must be a value greater than the old limit ({})" [ new-limit, old-request-limit ]))
        (update accounts account { "request-limit": new-limit }))))

  (defun set-account-limit:string (account:string new-limit:decimal)
    (with-capability (ADMIN)
      (with-read accounts account { "account-limit" := old-account-limit }
        (enforce (> new-limit old-account-limit)
          (format "The new account limit {} must be a value greater than the old limit ({})" [ new-limit, old-account-limit ]))
        (update accounts account { "account-limit": new-limit }))))

  (defun return-funds:string (account:string amount:decimal)
    (with-capability (RETURN_FUNDS account amount)
      (with-read accounts account { "funds-returned" := returned }
        (coin.transfer account FAUCET_ACCOUNT amount)
        (update accounts account { "funds-returned": (+ returned amount )})))
  )

  (defun request-funds:string (receiver:string receiver-guard:guard amount:decimal)
    (with-capability (REQUEST_FUNDS receiver amount)
      (coin.transfer-create FAUCET_ACCOUNT receiver receiver-guard amount)
      (with-default-read accounts receiver
        { "funds-requested": 0.0
        , "funds-returned": 0.0
        , "request-limit": DEFAULT_REQUEST_LIMIT
        , "account-limit": DEFAULT_ACCOUNT_LIMIT
        }
        { "funds-requested" := requested
        , "funds-returned" := returned
        , "request-limit" := request-limit
        , "account-limit" := account-limit
        }
        (write accounts receiver
          { "funds-requested": (+ amount requested)
          , "funds-returned": returned
          , "request-limit": request-limit
          , "account-limit": account-limit
          })))
  )
)

(if (read-msg "upgrade")
  (format "{}" [ "upgrade complete" ])
  [ (create-table free.goliath-faucet.accounts)
  ])
