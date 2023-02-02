; The KETH token wraps ETH. If this were a proper implementation you could lock
; ETH on the Ethereum blockchain to mint KETH on Chainweb, but in this contract
; we just implement a KETH token we can use as a stand-in for ETH.
;
; You can also view this contract as a minimal KIP-0005 implementation. We've
; implemented only the fungible-v2 interface, plus an additional function that
; lets an administrator (Charkha) sign off on requests to mint coins. In the
; real world this would represent having locked up the equivalent ETH on the
; Ethereum blockchain.
;
; Since we're sticking to a minimum implementation of the fungible-v2 interface
; I've avoided using helper functions like (credit) and (debit) as seen in the
; coin-v5 contract, but they're a good idea. Try implementing them in this
; contract using coin-v5 as a reference!
(namespace "free")

(enforce-guard (keyset-ref-guard "free.charkha-admin-keyset"))

(module KETH GOVERNANCE
  @doc "KETH is a wrapped ETH for Chainweb, where 1 KETH == 1 ETH."

  ; This is a KIP-0005 token, so it must implement the fungible-v2 interface.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact
  (implements fungible-v2)

  ; ----------
  ; SCHEMAS

  ; The fungible-v2 interface provides an account-details schema. It is only a
  ; suggestion (we could implement a different schema if we want to), but for
  ; the sake of example we will use that schema to implement the KETH token.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L8-L13
  (deftable accounts:{fungible-v2.account-details})

  ; ----------
  ; CAPABILITIES

  (defcap GOVERNANCE ()
    (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset")))

  ; The fungible-v2 interface defines a TRANSFER managed capability:
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L18-L26
  ;
  ; A managed capability is like the unmanaged capabilities we normally use
  ; (like the GOVERNANCE capability in this file), with a twist: the capability
  ; is granted conditional on some value that may change over the course of the
  ; transaction, with the change determined by the @manager function.
  ;
  ; It is possible for the managed value to change such that the capability is
  ; revoked. For example, granting the TRANSFER capability below authorizes some
  ; Pact code to transfer the given amount from the sender to the receiver. Each
  ; time the Pact code calls (transfer), this capability will be checked, and if
  ; granted, the transfer manager will reduce the remaining balance that can be
  ; sent by the amount transferred. If the amount remaining ever drops to 0 then
  ; the capability will be not be granteda any more.
  (defcap TRANSFER:bool (sender:string receiver:string amount:decimal)
    @managed amount TRANSFER-mgr
    (enforce (!= sender receiver) "Sender cannot be the same as the receiver.")
    (enforce (!= sender "") "Sender cannot be empty.")
    (enforce (!= receiver "") "Receiver cannot be empty.")
    (enforce-unit amount) ; see (enforce-unit) later in this file for details.
    (enforce-guard (at 'guard (read accounts sender)))
    (enforce (> amount 0.0) "Transfer limit must be positive."))

  ; The TRANSFER-mgr function is required by the fungible-v2 interface as the
  ; counterpart to the TRANSFER capability. It is supposed to reduce the
  ; 'managed' amount by the amount 'requested' and verify that it does not lead
  ; to a negative balance.
  (defun TRANSFER-mgr:decimal (managed:decimal requested:decimal)
    (let ((balance (- managed requested)))
      (enforce (>= balance 0.0) (format "TRANSFER exceeded for balance {}" [managed]))
      balance))

  ; This capability is not in the fungible-v2 interface. As described in the
  ; Charkha guide, this capability is for the Charkha administrator to let you
  ; mint (ie. create) KETH for yourself, if you have locked up the equivalent
  ; ETH on the Ethereum blockchain in a contract controlled by Charkha. As with
  ; the (TRANSFER) capability we will use a managed capability, because Charkha
  ; will sign off on a certain amount of KETH (such as 10.0) in the transaction,
  ; and you should not be able to call (mint) over and over such that you exceed
  ; that limit.
  (defcap MINT:bool (receiver:string amount:decimal)
    ; We can reuse the TRANSFER-mgr manager function because the behavior is
    ; identical for minting, burning, and transferring: limit successive calls
    ; to the function to the overall signed amount.
    @managed amount MINT-mgr
    (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset"))
    (enforce (!= receiver "") "Receiver cannot be empty.")
    (enforce-unit amount)
    (enforce (> amount 0.0) "Mint limit must be positive."))

  (defun MINT-mgr:decimal (managed:decimal requested:decimal)
    (let ((balance (- managed requested)))
      (enforce (>= balance 0.0) (format "MINT exceeded for balance {}" [managed]))
      balance))

  (defcap BURN:bool (burner:string amount:decimal)
    @managed amount BURN-mgr
    (enforce (!= burner "") "Receiver cannot be empty.")
    (enforce-unit amount)
    (enforce (> amount 0.0) "Burn limit must be positive.")
    ; You can only burn funds for your own account, ie. you signed the BURN
    ; capability using the guard stored for the account in question.
    (with-read accounts burner { "guard" := guard }
      (enforce-guard guard)))

  (defun BURN-mgr:decimal (managed:decimal requested:decimal)
    (let ((balance (- managed requested)))
      (enforce (>= balance 0.0) (format "BURN exceeded for balance {}" [managed]))
      balance))

  ; ----------
  ; FUNCTIONS

  ; This is not in the fungible-v2 standard. It's a special function that
  ; assumes the presence of an ETH -> KETH bridge, in which you lock your funds
  ; in a Charkha contract on Ethereum in order for Charkha to sign off on you
  ; minting the equivalent KETH on Chainweb. Since this bridge does not exist,
  ; the Charkha UI will simply let you lock up arbitrary ETH without verifying
  ; it, and then you can mint the equivalent amount in KETH.
  (defun mint (receiver:string receiver-guard:guard amount:decimal)
    @doc "Mint KETH up to the amount you have locked on the ETH->KETH bridge."
    (with-capability (MINT receiver amount)
      (with-default-read accounts receiver
        { "balance": 0.0, "guard": receiver-guard }
        { "balance" := receiver-balance, "guard" := existing-guard }
        ; We should not overwrite the guard — that's what (rotate) is for — so
        ; here we verify that either a. the account did not exist, and so we set
        ; the guard to what we received in our arguments, or b. the account
        ; exists, and it has the same guard that was provided via the arguments.
        (enforce (= receiver-guard existing-guard) "Supplied receiver guard must match existing guard.")
        ; If the guards check out, we can write the entry to the database. If
        ; the account exists, this is the same as an update as only the balance
        ; changes. If not, then this is an insertion.
        (write accounts receiver
          { "balance": (+ receiver-balance amount)
          , "guard": receiver-guard
          , "account": receiver
          }))))

  ; This is not in the fungible-v2 standard. It's a special function that allows
  ; you to burn (ie. destroy) a certain amount of KETH on Chainweb, which will
  ; allow you to withdraw the same amount from the ETH->KETH bridge on the
  ; Ethereum blockchain.
  (defun burn:string (burner:string amount:decimal)
    @doc "Burn KETH to unlock equivalent ETH on the Ethereum blockchain."
    (with-capability (BURN burner amount)
      (with-default-read accounts burner { "balance": 0.0 } { "balance" := balance }
        (enforce (<= amount balance) (format "Cannot burn more funds than the account has available: {}" [balance]))
        (update accounts burner { "balance": (- balance amount)}))))

  ; KIP-0005 requires (transfer), which transfers funds from a sender to a
  ; receiver, where the receiver account must exist. The interface doesn't
  ; specify it, but we should use the TRANSFER capability here to protect the
  ; transaction.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L41-L53
  (defun transfer:string (sender:string receiver:string amount:decimal)
    ; Normally we'd have more property tests here, but the fungible-v2 interface
    ; already specifies several which will be run automatically. We only need to
    ; specify additional properties.
    @model [ (property (= 0.0 (column-delta accounts "balance"))) ]

    (with-capability (TRANSFER sender receiver amount)
      ; First, we'll debit funds from the sender's account. Recall that
      ; (with-read) will fail the transaction if there is no value in the
      ; database at the given key.
      (with-read accounts sender { "balance" := sender-balance }
        (enforce (<= amount sender-balance) "Insufficient funds.")
        (update accounts sender { "balance": (- sender-balance amount) }))

      ; Next, we'll credit funds to the receiver's account. Remember that
      ; transactions in Pact are atomic; if this (with-read) fails, indicating
      ; that the receiver does not exist, then the entire transaction will roll
      ; back. No funds will be debited from the sender.
      (with-read accounts receiver { "balance" := receiver-balance }
        (update accounts receiver { "balance": (+ receiver-balance amount) }))))

  ; KIP-0005 requires (transfer-create), which, given a guard for the receiver,
  ; transfers funds from a sender to receiver, creating the receir account with
  ; the given guard if the account doesn't exist.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L41-L53
  (defun transfer-create:string (sender:string receiver:string receiver-guard:guard amount:decimal)
    @model [ (property (= 0.0 (column-delta accounts "balance"))) ]

    (with-capability (TRANSFER sender receiver amount)
      (with-read accounts sender { "balance" := sender-balance }
        (enforce (<= amount sender-balance) "Insufficient funds.")
        (update accounts sender { "balance": (- sender-balance amount) }))

      ; From this point on, this behaves the same as (mint) did, as we credit
      ; the user's account.
      (with-default-read accounts receiver
        { "balance": 0.0, "guard": receiver-guard }
        { "balance" := receiver-balance, "guard" := existing-guard }
        (enforce (= receiver-guard existing-guard) "Supplied receiver guard must match existing guard.")
        (write accounts receiver
          { "balance": (+ receiver-balance amount)
          , "guard": receiver-guard
          , "account": receiver
          }))))

  ; KIP-0005 requires (get-balance), which returns the current balance of the
  ; given account, failing if the account does not exist.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L97-L100
  (defun get-balance:decimal (account:string)
    (with-read accounts account { "balance" := balance }
      balance))

  ; KIP-0005 requires (details), which returns information about an account.
  ; It's basically the same as a table read against the schema provided by the
  ; fungible-v2 interface.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L102-L106
  (defun details:object{fungible-v2.account-details} (account:string)
    (read accounts account))

  ; KIP-0005 requires (precision), which specifies a maximum precision for
  ; transaction amounts. In other words, you should not be able to send an
  ; amount with more than (precision) digits in the decimal place. We'll use 13,
  ; which is frequently used in financial applications (CoinMarketCap, for
  ; example, returns quotes at this level of precision).
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L108-L111
  (defun precision:integer ()
    13)

  ; KIP-0005 requires (enforce-unit), which enforces a maximum precision for
  ; transactions. In short, this is the enforcement counterpart to the
  ; (precision) function required above.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L113-L116
  (defun enforce-unit:bool (amount:decimal)
    ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#floor
    (enforce (= amount (floor amount 13)) "Amounts cannot exceed 13 decimal places."))

  ; KIP-0005 requires (create-account), which allows transaction to register
  ; a guard associated with an address. This guard will then be used to protect
  ; the user account in (transfer) and other operations.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L118-L123
  (defun create-account:string (account:string guard:guard)
    ; The user creating the account should have to sign the transaction, proving
    ; they indeed want this guard associated with their address. This is similar
    ; to deployments: you don't want a typo to render an account inaccessible!
    (enforce-guard guard)
    ; We will use 'insert' instead of 'write' so that this transaction fails if
    ; the account already exists.
    ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#insert
    (insert accounts account { "account": account, "balance": 0.0, "guard": guard })
    "Account created!")

  ; KIP-0005 requires (rotate), which allows a user to update the guard
  ; associated with their account. The transaction must satisfy the existing
  ; guard and then install the new guard.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L125-L131
  (defun rotate:string (account:string new-guard:guard)
    (with-read accounts account { "guard" := old-guard }
      (enforce-guard old-guard)
      (update accounts account { "guard" : new-guard })))

  ; ----------
  ; PACTS

  ; KIP-0005 requires (transfer-crosschain), which implements a (transfer) from
  ; one chain to another. This is a complicated function, because it involves
  ; debiting funds on the current chain, then executing a 2-step pact to credit
  ; the funds on the destination chain.
  ; https://github.com/kadena-io/KIPs/blob/8ec1b7c6e2596778e169182339eeda7acbae4abc/kip-0005/fungible-v2.pact#L73-L95
  ;
  ; We will implement (transfer-crosschain) for KETH to be faithful to the
  ; fungible-v2 interface. But keep in mind that multi-chain applications are
  ; an advanced topic, and Charkha will be implemented on one chain. We will
  ; not implement (transfer-crosschain) for our other tokens (we'll throw an
  ; "unsupported" exception instead). However, it's important to see an example
  ; of how you might implement cross-chain transfers yourself, so here you go.
  ;
  ; Before we begin, we should define a schema for the data that we will pass
  ; from the first step on the current chain to the second step on the target
  ; chain. This is necessary to keep the Pact type-checker happy.
  (defschema transfer-crosschain-schema
    @doc "Schema for yielded (transfer-crosschain) arguments."
    receiver:string
    receiver-guard:guard
    amount:decimal)

  ; Now we can implement the (transfer-crosschain) pact.
  ; https://pact-language.readthedocs.io/en/stable/pact-reference.html#defpact
  (defpact transfer-crosschain:string (sender:string receiver:string receiver-guard:guard target-chain:string amount:decimal)
    ; Pacts are similar to functions, but they happen as multiple distinct
    ; transactions, each represented as a "step".
    ; https://pact-language.readthedocs.io/en/stable/pact-reference.html#step
    ;
    ; These arguments are only available to the first step of the pact; to
    ; continue passing data to subsequent steps it is necessary to "yield" the
    ; data, and then "resume" using the yielded data in the next step.
    ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#yield
    ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#resume
    (step
      (with-capability (TRANSFER sender receiver amount)
        ; Just like how our oracle contract read the block time from the chain
        ; data, we can verify that the user is indeed doing a cross-chain
        ; transfer by reading the chain-id from the chain data.
        ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#chain-data
        (enforce (!= (at "chain-id" (chain-data)) target-chain) "Target chain cannot be current chain.")
        (enforce (!= "" target-chain) "Target chain cannot be empty.")
        (enforce-unit amount)

        ; As with (transfer), our first order of business is to debit funds from
        ; the sender on the current chain.
        (with-read accounts sender { "balance" := sender-balance }
          (enforce (<= amount sender-balance) "Insufficient funds.")
          (update accounts sender { "balance": (- sender-balance amount) }))

        ; Now that we have debited from the sender account there is nothing more
        ; to do on this chain. Thus we "yield" the pact with some data, which
        ; will be passed to next step of the pact on the target chain.
        ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#yield
        (yield
          ; We have to use this somewhat kludgy "let" form in order to specify
          ; a type for the value we are passing through the continuation.
          (let
            ((payload:object{transfer-crosschain-schema}
                { "receiver": receiver
                , "receiver-guard": receiver-guard
                , "amount": amount
                }))
            payload)
          target-chain)))

    (step
      ; In the next step, on the target chain, we can resume the computation by
      ; binding to the data we previously yielded.
      ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#resume
      (resume { "receiver" := receiver, "receiver-guard" := receiver-guard, "amount" := amount }
        ; It is only possible to reach this step having successfully executed
        ; the first part of the pact, so we don't need to request TRANSFER again.
        (with-default-read accounts receiver
          { "balance": 0.0, "guard": receiver-guard }
          { "balance" := receiver-balance, "guard" := existing-guard }
          (enforce (= receiver-guard existing-guard) "Supplied receiver guard must match existing guard.")
          (write accounts receiver
            { "balance": (+ receiver-balance amount)
            , "guard": receiver-guard
            , "account": receiver
            })))))

)

(if (read-msg "init")
  (create-table free.KETH.accounts)
  "Upgrade complete")
