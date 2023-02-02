; The Goliath faucet allows any Goliath wallet user to ask for KDA to get their
; new wallet started. Technically, the faucet is accessible to anyone on
; Chainweb and they can call (request-funds) for themselves. However, transfers
; must be signed by the faucet account, so in practice only software that has
; access to the faucet account keys can request funds on behalf of its users,
; and that means the Goliath wallet software — or you, since I've committed the
; faucet account keys to the request/keys directory.
;
; We'll implement these features in idiomatic Pact:
;
; 1. Any Goliath user can request funds from the faucet, with the faucet account
;    signing on their behalf.
; 2. By default, users can request up to 20.0 KDA per call to request-funds and
;    up to 100.0 KDA in total.
; 3. The faucet account can increase the per-request and per-account limits for
;    any account (but it cannot decrease them).
; 4. You can return funds to the Goliath faucet, which will credit against your
;    total account limit.
; 5. You can look up your account's per-account and per-request limits and see
;    how much KDA you can still request.

; --------------------
; GOLIATH FAUCET CONTRACT
; --------------------

; Welcome to the Goliath faucet smart contract!
;
; We're using the Pact smart contract language. A smart contract can contain a
; mixture of:
;
; * Top-level Pact code that is executed on-chain when you deploy the contract
; * Pact code organized into interfaces and modules, which can be called via
;   other smart contracts or by sending Pact code to a Chainweb node at its Pact
;   endpoint for evaluation.
;
; A typical Pact smart contract executes some top-level setup code by defining
; one or more keysets and entering a namspaces. Then, it defines a module and/or
; interface that other modules can reference (or you can execute by sending Pact
; code to your local Chainweb node). Finally, it executes more top-level code to
; initialize data required by the module, such as creating new tables. Each of
; these steps introduces critical concepts for Pact development.
;
; We'll take all these steps in our smart contract. We'll begin by exploring
; namespaces, keysets, interfaces, and modules. Then we'll implement the
; "goliath-faucet" module and finish up by initializing some data.

; ----------
; NAMESPACES
; ----------

; Our contract begins by entering a namespace.
;
; Modules, interfaces, and keysets in Pact must have unique names within a
; particular 'namespace'. On a private blockchain you can define your own
; amespace or use the "root" namespace (ie. no namespace at all). On a public
; blockchain the root namespace is reserved for built-in contracts (like the
; `coin` contract, which we'll see later), and on Chainweb specifically you can
; only define a new namespace with the approval of the Kadena team.
;
; In short, we technically can define a namespace with (define-namespace) in our
; contract but, practically speaking, we can't do this on Chainweb. So we can't
; define a namespace, and we can't use the root namespace. What are we to do?
;
; Chainweb exposes two namespaces for public use: `free` and `user`. You can
; define interfaces, modules, and keysets inside either of these two interfaces.
; To do that, enter the namespace with the (namespace) function:
; https://pact-language.readthedocs.io/en/stable/pact-functions.html#namespace
;
; We'll use the 'free' namespace for our contract:
(namespace "free")

; ----------
; KEYSETS
; ----------

; Our smart contract will be governed by a keyset named "goliath-faucet-keyset",
; within the "free" namespace. This means the contract can only be upgraded in
; a transaction that was signed by the private keys that satisfy the keyset
; that "free.goliath-faucet-keyset" refers to.
;
; It's absolutely critical that we register this keyset before we deploy the
; contract. If we forget, then someone else can come along and register the
; "free.goliath-faucet-keyset" name with their own keyset, and then they
; control our contract!
;
; In this step we will ensure we've registered this keyset. But before we go
; on: what, exactly, is a keyset?
;
; Public-key authorization is widely used in smart contracts to ensure that only
; the holders of specific keys can take certain actions (such as transferring
; funds from their account). Pact integrates single- and multi-signature public-
; key authorization into smart contracts directly via the concept of "keysets".
; Pact has other tools for authorization as well; as a whole, authorization in
; Pact is handled via "guards" or "capabilities" (we'll learn about both later),
; and a keyset is a specific kind of guard.
;
; A keyset pairs a set of public keys with a predicate function. In JSON form it
; looks like this:
;
;   { "keys": [ "abc123" ], "pred": "keys-all" }
;
; Pact will check the predicate function against the set of keys when the keyset
; is used as a guard. If the predicate fails then access is denied. There are
; a few built-in predicate functions, such as the "keys-all" function above;
; this predicate means means that the transaction must include private key
; signatures for every public key in the set. You can also write your own
; predicate functions (for example, to authorize access according to a vote).
; https://pact-language.readthedocs.io/en/latest/pact-reference.html#keysets-and-authorization
;
; Keysets are simple data, but you will typically register a unique name for
; keysets you are using in your contracts. To "register" a keyset is to store
; it on the blockchain with a unique name, called a "keyset reference", via the
; (define-keyset) function. When evaluated, Pact will either register the
; keyset at the given name on Chainweb or, if the name is already registered,
; it will "rotate" (ie. update) the keyset at that name to the provided value.
; https://pact-language.readthedocs.io/en/stable/pact-functions.html#define-keyset
;
; If you ever want to see the current value of a keyset reference, you
; can look it up by name by sending this code to a Chainweb node:
;
;    (describe-keyset "free.my-keyset")
;
; Let's proceed with registering the "free.goliath-faucet-keyset". How do we
; know what keyset to register?
;
; It's common practice to provide the keyset that we'd like to register as part
; of the transaction data. You can parse data from the transaction using
; the (read-*) family of functions:
; https://pact-language.readthedocs.io/en/stable/pact-functions.html#read-msg
; https://pact-language.readthedocs.io/en/stable/pact-functions.html#read-keyset
; https://pact-language.readthedocs.io/en/stable/pact-functions.html#read-string
; https://pact-language.readthedocs.io/en/stable/pact-functions.html#read-integer
; https://pact-language.readthedocs.io/en/stable/pact-functions.html#read-decimal
;
; Our deployment transaction will be sent with two pieces of data:
;
; * 'init': a boolean indicating whether we intend this as a deployment or as
;   an upgrade to the already-deployed module; if we are upgrading then we can
;   skip the keyset definition and initialization steps.
; * 'goliath-faucet-keyset': a keyset that should be registered as the
;   "free.goliath-faucet-keyset" keyset on-chain.
;
; Below, we read the Goliath faucet keyset from the transaction data and
; register it. If the keyset reference doesn't exist then it will be created and
; our Pact module can refer to it when guarding sensitive information. If the
; reference already exists, then Pact will use the transaction signatures to
; determine whether the keyset at that reference is satisfied; if so, then it
; will overwrite it.
;
; To see how to provide a keyset in transaction data please refer to the
; faucet.repl file and the deploy-faucet-contract.yaml file.
;
; There's just one last thing to do before we register our keyset: verify it!
; There are multiple reasons to do this.
;
; First, what if we have a typo in the keyset we sent in the transaction data?
; The incorrect keyset will be registered and we'll be unable to access anything
; guarded by it!
;
; Second, you don't have to define a keyset inside your smart contract. You may
; wish to reuse the same keyset reference in multiple contracts, and so you
; simply reuse the keyset reference in your contract. This can be dangerous,
; however. If you deploy a contract referring to a keyset but you forgot to
; register that keyset, then someone else can register the keyset with their
; keys and gain access to your guarded data.
;
; To prevent these risks it's a best practice to always enforce a keyset guard
; on the transaction that deploys the contract. This guard should ensure that
; any keysets passed to the contract were also used to sign the transaction that
; deploys the contract. If the enforcement fails, the deployment is aborted,
; and you can fix the keyset and try again.
; https://pact-language.readthedocs.io/en/stable/pact-functions.html#keyset-ref-guard
(enforce-keyset (read-keyset "goliath-faucet-keyset"))
(define-keyset "free.goliath-faucet-keyset" (read-keyset "goliath-faucet-keyset"))

; ----------
; INTERFACES & MODULES
; ----------

; So far we've been writing code at the top level. Code at the top level is
; ordinary Pact that Chainweb can execute. However, when you are defining a new
; smart contract, you need to organize your Pact code into interfaces and/or
; modules so that it can be referenced later from other contracts or via a
; Chainweb node's Pact API. Chainweb will store your interfaces and modules
; within the namespace you've entered.
;
; Interfaces and modules are both units for organizing Pact code, but they serve
; different purposes. An interface describes the API that a module will
; implement and can supply constants and models for formal verification to aid
; in that implementation, but it doesn't contain any implementations itself and
; cannot be executed on Chainweb.
; https://pact-language.readthedocs.io/en/stable/pact-reference.html#interfaces
;
; Interfaces purely exist as a method of abstraction. An interface can be
; implemented by multiple modules (that means that the module provides an
; implementation for every function included in the interface), so it serves
; as a blueprint for implementors. Also, Pact functions take a reference to module as an argument so long as the
; module implements a specific interface. That means you can write a function
; that can be used with any module that implements the given interface — a
; powerful form of abstraction.
; https://pact-language.readthedocs.io/en/stable/pact-reference.html#module-references
;
; We don't use interfaces in our contract because it's quite small and no one
; else is expected to provide another implementation for its API. Instead, we
; skip straight to the implementation: the 'goliath-faucet' module.
;
; A module in Pact is the primary unit of organization for Pact code. Modules
; can contain functions, pacts, capabilities, tables, and other Pact code:
; https://pact-language.readthedocs.io/en/stable/pact-reference.html#module
;
; Let's define a Pact module with the code for our faucet. To define a module
; we must provide a module name, a module governance function, and then the
; module body containing the implementation.
;
; The **module name** is used to refer to the module from other modules (or in
; the REPL). For example, `coin.transfer` refers to the `transfer` function
; defined in the `coin` module. To refer to a module it must have been deployed
; to Chainweb (or loaded into the REPL). We'll name our module `goliath-faucet`.
; Since we're within the `free` namespace, that means we can refer to our module
; on Chainweb with the prefix `free.goliath-faucet`.
;
; The **module governance function** restricts how the contract can be upgraded.
; Governance functions can be a keyset reference, which means that the contract
; can be upgraded so long as the upgrade transaction satisfies the keyset, or
; they can be a "capability" defined in the module. We'll learn a lot more about
; capabilities later and will use a keyset reference as our governance.
; https://pact-language.readthedocs.io/en/latest/pact-reference.html#keysets-vs-governance-functions
(module goliath-faucet "free.goliath-faucet-keyset"
  ; Now, let's implement the body of our module. We'll begin with the two forms
  ; of metadata we can use to annotate our modules, interfaces, functions, table
  ; schemas, and other Pact code. The @doc metadata field is for documentation
  ; strings, and the @model metadata field is for formal verification.
  ; https://pact-language.readthedocs.io/en/latest/pact-reference.html#docs-and-metadata

  ; ----------
  ; METADATA
  ; ----------

  ; It's a best practice to document interfaces, modules, functions, table
  ; schemas, and other Pact code using the @doc metadata field. We'll do that
  ; throughout our contract, beginning with the module itself.
  @doc
    "'goliath-faucet' represents the Goliath Faucet Contract. This contract    \
    \provides a small number of KDA to any Kadena user who needs some. To      \
    \request funds for yourself (Chain 0 only):                                \
    \  > (free.goliath-faucet.request-funds ...)                               \
    \                                                                          \
    \To check your account's request and total limits:                         \
    \  > (free.goliath-faucet.get-limits ...)                                  \
    \                                                                          \
    \To return funds to the faucet account (Chain 0 only):                     \
    \  > (free.goliath-faucet.return-funds ...)"

  ; The second metadata type is @model. It allows us to specify properties that
  ; functions must satisfy and invariants that table schemas must satisfy. Pact,
  ; via the Z3 theorem prover, can prove that there is no possible set of
  ; variable assignments in our code that will violate the given property or
  ; invariant. Or, if it does find a violation, it can tell us so we can fix it!
  ; https://pact-language.readthedocs.io/en/stable/pact-properties.html
  ; https://pact-language.readthedocs.io/en/stable/pact-properties.html#what-do-properties-and-schema-invariants-look-like
  ;
  ; Properties (but not invariants) can be defined at the top level of the
  ; module so they can be reused in multiple functions:
  ; https://pact-language.readthedocs.io/en/latest/pact-properties.html#defining-and-reusing-properties
  ;
  ; We have a few functions that should never succeed unless they were called in
  ; a transaction signed by the Goliath faucet keyset. We can capture that
  ; property in a reusable definition. We'll see examples of *using* this
  ; property within a function later on.
  @model
    [ (defproperty faucet-authorized (authorized-by "free.goliath-faucet-keyset"))
    ]

  ; ----------
  ; Constants
  ; ----------

  ; It's useful to define constants in your interface for values that will be
  ; used in several functions, or values that other modules should be able to
  ; refer to.
  ;
  ; Our faucet contract has a specific range of values that it will allow the
  ; per-request and per-account limits to be set to. It's useful to capture
  ; these values in variables that our tests, module code, and other modules on
  ; Chainweb can refer to. To expose a constant value, use `defconst`:
  ; https://pact-language.readthedocs.io/en/latest/pact-reference.html#defconst
  (defconst FAUCET_ACCOUNT "goliath-faucet"
    @doc "Account name of the faucet account that holds and disburses funds.")

  (defconst DEFAULT_REQUEST_LIMIT 20.0
    @doc "Users can at minimum ask for up to 20 KDA per request.")

  (defconst DEFAULT_ACCOUNT_LIMIT 100.0
    @doc "Users can at minimum ask for up to 100 KDA per account.")

  ; --------------------
  ; Schemas & Tables
  ; --------------------

  ; When your smart contract needs to persist some data across multiple calls to
  ; functions in the contract, it should use a table. Tables in Pact are
  ; relational databases and have a key-row structure. Keys are always strings.
  ; You can define a table with `deftable`:
  ; https://pact-language.readthedocs.io/en/stable/pact-reference.html#deftable
  ;
  ; Our smart contract needs to persist four pieces of data. First, we need to
  ; record how much KDA in total each account has requested and returned so that
  ; we know when a request would exceed the per-account limit. We also need to
  ; record the per-request and per-account limits, as they can be adjusted by
  ; the faucet account at any time.
  ;
  ; Before we define any tables, however, we should define schemas for them. The
  ; schema for a table specifies the table columns and their data types:
  ; https://pact-language.readthedocs.io/en/stable/pact-reference.html#defschema
  ;
  ; The schema will be used to verify we are using the right types when reading
  ; or writing the table. For example, Pact can typecheck our module and ensure
  ; we never try to provide a string for an integer column, or try to insert a
  ; row that's missing a column.
  ;
  ; By convention, we use the same name for a table and its schema, except we
  ; give the schema a -schema suffix.
  (defschema accounts-schema
    ; We've seen @model used to define some reusable properties at the module
    ; level. Now, let's see how to leverage invariants (ie. formal verification
    ; for table schemas) to guarantee it is never possible for an address to
    ; exceed their account limit or return more funds than they have requested.
    ;
    ; To specify an invariant, use (invariant) and provide a predicate; the Z3
    ; theorem prover will check that the variables used in your predicate can
    ; never have values that would fail the predicate. Not all Pact functions
    ; can be used in the predicate; you can see a list of avaiable ones here:
    ; https://pact-language.readthedocs.io/en/stable/pact-properties-api.html#property-and-invariant-functions
    ;
    ; The first invariant ensures that you can never receive more funds than
    ; your account limit. The second ensures you can never return more funds
    ; than you have received.
    @model
      [ (invariant (<= (- funds-requested funds-returned) account-limit))
        (invariant (>= (- funds-requested funds-returned) 0.0))
      ]

    ; Now we define our four columns and their types.
    funds-requested:decimal
    funds-returned:decimal
    request-limit:decimal
    account-limit:decimal)

  ; Now that we have our schema we can define a table which uses it with
  ; the (deftable) function.
  ; https://pact-language.readthedocs.io/en/stable/pact-reference.html#deftable
  ;
  ; We'll refer to the table by name when we need to insert, read, or update
  ; data. When our module is deployed, we'll also need to create the table using
  ; the `create-table` function (this must be called outside the module):
  ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#create-table
  ;
  ; Pact supplies several data-access functions for working with tables:
  ; https://pact-language.readthedocs.io/en/latest/pact-functions.html#database
  ;
  ; Note that these functions can only be called by functions within the module
  ; that defined the table, or in a transaction that satisfies the module
  ; governance function. Beyond these points of access, no one can read or write
  ; to tables directly.
  (deftable accounts:{accounts-schema})

  ; ----------
  ; CAPABILITIES
  ; ----------

  ; Next, let's explore a fundamental pair of concepts in Pact: guards and
  ; capabilities.
  ;
  ; A guard in Pact defines a rule that must be satisfied for the transaction
  ; to continue. We've seen an example already: keysets are one type of guard.
  ; But there are others, such as pact guards (used to verify cross-chain
  ; transactions) and user guards (arbitrary user-defined predicate functions).
  ; In short, guards are pure predicate functions over the given environment,
  ; which can be enforced at any time with (enforce-guard).
  ;
  ; A capability, on the other hand, implements fine-grained control over how a
  ; guard is deployed to grant some access to a user of the smart contract.
  ; Capabilities in Pact are an entire system for managing user rights during
  ; the execution of a transaction.
  ;
  ; You can define a new capability with (defcap). An unmanaged capability
  ; consists of a name, a list of arguments, optional metadata, and a function
  ; body that returns a boolean. For example, an ADMIN capability might ensure
  ; that a specific keyset must be satisfied in order to take some action:
  ;
  ;   (defcap ADMIN ()
  ;     (enforce-guard (keyset-ref-guard "free.my-keyset"))
  ;
  ; Capabilities can implement more sophisticated rules, such as orchestrating
  ; a vote to determine whether the contract can be upgraded. You can learn
  ; more about capabilities in the Pact documentation:
  ; https://pact-language.readthedocs.io/en/latest/pact-reference.html#capabilities
  ;
  ; There are four critical things to know about capabilities.
  ;
  ; First, you can grant a capability to a function with (with-capability), and
  ; you can protect some sensitive code with the (require-capability) function.
  ; "Granting" a capability means that calls to (require-capability) will
  ; succeed so long as the capability is in scope.
  ; https://pact-language.readthedocs.io/en/latest/pact-functions.html#with-capability
  ; https://pact-language.readthedocs.io/en/latest/pact-functions.html#require-capability
  ;
  ; Second, you can only grant a capability within the module that defined the
  ; corresponding capabilitiy. That means, for example, that protecting code
  ; with (require-capability) means that code cannot be called from outside the
  ; module, because its required capability can only be granted within the
  ; module. This is a helpful way to make particular functions private.
  ;
  ; Third, capabilities come in two flavors: unmanaged and managed. Acquiring
  ; either will let you access code protected by (require-capability). However,
  ; unmanaged capabilities are static (they only rely on their parameters and
  ; transaction data to determine whether the capability should be granted),
  ; whereas managed capabilities are dynamic (they additionally rely on state
  ; that can change each time the capability is requested during a given
  ; transaction). By convention, unmanaged capabilities are "granted" and
  ; managed capabilities are "installed". You can tell that a capability is
  ; managed if it uses the @managed metadata field.
  ;
  ; We won't use managed capabilities in this contract, but you can learn more
  ; about them here:
  ; https://pact-language.readthedocs.io/en/latest/pact-reference.html#signatures-and-managed-capabilities
  ; https://stackoverflow.com/questions/72746446/what-are-the-semantics-of-capability-manager-functions-in-pact
  ;
  ; Finally, signers of a Pact transaction can scope their signature to one or
  ; more capabilities in the module. This indicates that the signer has agreed
  ; to grant the specified capabilities if they are asked for via the
  ; (with-capability) function, but other capabilities should be denied.
  ; Managed capabilities must always be signed for; unmanaged capabilities don't
  ; have to be signed for unless they use a keyset guard. You can see examples
  ; of scoping a signature to a capability in the faucet.repl file and in the
  ; various 'send' request files.
  ;
  ; Our contract will use one capability: SET_LIMIT. It ensures that calls to
  ; change the per-request and per-account limits for a given account *must* be
  ; signed for by the goliath-faucet account.
  ;
  ; The module's SET_LIMIT capability will be a simple keyset guard. To grant
  ; this capability in a function in this module with (with-capability), the
  ; transaction that calls that function must be signed by the goliath-faucet
  ; private key, scoped to the SET_LIMIT capability.
  (defcap SET_LIMIT ()
    @doc "Enforce only faucet account can raise limits."
    (enforce-guard (keyset-ref-guard "free.goliath-faucet-keyset")))

  ; --------------------
  ; Functions
  ; --------------------

  ; Now for the fun part! It's time to implement the core logic of our smart
  ; contract. Each feature of the contract will be represented by a function.
  ; We'll implement functions for users to request and return funds and to look
  ; up their account limits. We'll also implement two admin-only functions to
  ; adjust an account's limits.
  ;
  ; Along the way we'll see how to grant capabilities, prevent invalid states,
  ; read and write tables, format strings, and more.

  ; Our first function lets users request funds from the faucet. Specifically,
  ; we will call the (coin.transfer-create) function from the coin contract IF
  ; the requested amount is within the account limits for the receiving account.
  ; If our checks pass (the amount is valid), then we'll transfer the funds and
  ; then update our accounts table to reflect the transfer.
  (defun request-funds:string (receiver:string receiver-guard:guard amount:decimal)
    @doc
      "Request that funds are sent to the account denoted as the 'receiver'. If\
      \the account does not exist then it will be created and be guarded by the\
      \provided 'receiver-guard' keyset."

    ; We'll use two properties to help ensure correct behavior for this
    ; function. First, the transaction should only succeed if the address
    ; requested a positive amount. Second, if the transaction succeeded, then
    ; the table at the 'funds-requested' column must have increased by the
    ; amount requested. The first property is a simple check, but the second
    ; uses a property-only function called (column-delta):
    ; https://pact-language.readthedocs.io/en/stable/pact-properties-api.html#column-delta
    ;
    ; Recall that due to our schema invariants we have some additional checks
    ; that verify that our table writes are always within the valid bounds of
    ; our account and request limits. But they won't stop us from forgetting to
    ; write to the table at all, or from writing a value that's not the exact
    ; amount the user requested. (column-delta) can ensure that for us.
    @model
      [ (property (> amount 0.0))
        (property (= amount (column-delta accounts "funds-requested")))
      ]

    ; Pact's formal verification will check that your implementation satisfies
    ; the two properties above, but we still have to write the code that
    ; *prevents* the invalid states. To abort a transaction if it fails to meet
    ; a condition, use (enforce):
    ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#enforce
    ;
    ; To see formal verification in action, comment out this line and re-run
    ; the REPL file.
    (enforce (> amount 0.0) "Amount must be greater than 0.0")

    ; We still need to verify that the amount is within the account's limits. To
    ; do that, we must read the receiver's limits from the accounts table if
    ; it exists there (ie. it has requested funds before), or assume the
    ; default limits if not.
    ;
    ; There are a number of functions for reading and writing tables. One of the
    ; most common is (with-default-read), which is used to read a row from a
    ; table, with a fallback value in the case the row does not exist:
    ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#with-default-read
    ;
    ; The ':=' operator indicates that we are storing the value of the column
    ; on the left-hand side in the variable name on the right-hand side within
    ; the scope of the (with-default-read) call.
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
      ; From this point on we have access to the values of the four columns
      ; associated with the receiver account in the accounts table. Let's use
      ; them to bind a helper variable, 'balance', that records the difference
      ; between the total requested funds and the total returned funds. This
      ; balance is what should be checked against the account limit.
      ;
      ; We can introduce local variables with (let):
      ; https://pact-language.readthedocs.io/en/stable/pact-reference.html#let
      (let ( (balance (- requested returned)) )
        ; Now, we can finally enforce that the requested amount does not exceed
        ; the request limit.
        (enforce (<= amount request-limit)
          (format "{} exceeds the account's per-request limit, which is {}" [ amount request-limit ]))

        ; We can also ensure that transferring the requested amount would not
        ; result in exceeding the total account limit.
        (enforce (<= (+ amount balance) account-limit)
          (format "{} would exceed the account's total limit ({} remains of {} total)" [ amount (- account-limit balance) account-limit ]))

        ; With these checks satisfied, we know that the address has requested a
        ; valid amount and we process the transfer using the (coin.transfer-create)
        ; function:
        ; https://github.com/kadena-io/chainweb-node/blob/56e99ae421d2269a657e3bb3780c6d707e5149a0/pact/coin-contract/v5/coin-v5.pact#L358-L362
        ;
        ; Notice that the (coin.transfer-create) function grants a capability,
        ; (coin.TRANSFER), as part of its implementation:
        ; https://github.com/kadena-io/chainweb-node/blob/56e99ae421d2269a657e3bb3780c6d707e5149a0/pact/coin-contract/v5/coin-v5.pact#L377
        ;
        ; That means that a transaction that calls this (request-funds) function
        ; must be signed by the faucet account keys, and that signature must be
        ; scoped to the (coin.TRANSFER) capability. To see examples of how to
        ; do this, please see the faucet.repl file and the request-funds.yaml
        ; request file!
        (coin.transfer-create FAUCET_ACCOUNT receiver receiver-guard amount)

        ; If the transfer succeeded, then we should update the accounts table
        ; to indicate the user has requested more funds. If you'd like to see
        ; our formal verification in action, try "accidentally" hardcoding the
        ; funds-requested update below to a specific number.
        (write accounts receiver
          { "funds-requested": (+ amount requested)
          , "funds-returned": returned
          , "request-limit": request-limit
          , "account-limit": account-limit
          }))))

  ; Our next two functions can only be called by the faucet account itself. They
  ; adjust the per-request or per-account limit for a given address.
  ;
  ; We'll implement checks to ensure that the new limits are greater than the
  ; old limits and that the transaction executing this function was signed by
  ; the faucet account.
  (defun set-request-limit:string (account:string new-limit:decimal)
    @doc "Set a new per-request limit for requesting funds from the faucet."

    ; Once again we'll reach for property tests to ensure our function is
    ; correct. The first property test verifies that the faucet signed this
    ; transaction – it's referring to the (faucet-authorized) property we
    ; defined at the module level earlier in our code. The second property test
    ; verifies that if this transaction succeeded, then the accounts table row
    ; for this account, at the "request-limit" column, has been updated to be
    ; the value provided to this function. Similarly to (column-delta), we can
    ; use this to verify that the table is written correctly.
    ; https://pact-language.readthedocs.io/en/stable/pact-properties-api.html#read
    @model
      [ (property faucet-authorized)
        (property (= new-limit (at "request-limit" (read accounts account "after"))))
      ]

    ; The primary way to enforce a condition in a function is the (enforce)
    ; function. However, we can also put enforcement logic into a capability.
    ; A function can only acquire that capability via (with-capability) if the
    ; enforcement checks in the capability succeed. Capabilities are the best
    ; tool to reach for when you want to pass a transaction only if it was
    ; signed with particular keys; in our case, we have a (SET_LIMIT) capability
    ; that enforces that the "free.goliath-faucet-keyset" keyset must be
    ; satisfied in order for the SET_LIMIT capability to be granted.
    ;
    ; Since we want the (set-request-limit) to be only called by the faucet
    ; account, the SET_LIMIT capability is the perfect way to restrict access
    ; to this function. To see an example of how to sign a transaction with this
    ; capability, please refer to the faucet.repl file or the
    ; set-user-request-limit.yaml request file.
    (with-capability (SET_LIMIT)
      ; We used (with-default-read) before because we wanted to provide a
      ; fallback value in case the account had never requested funds before.
      ; This function is different: it should not be possible to update the
      ; limits for an account that hasn't yet requested anything. (with-read)
      ; will fail the transaction if the given account does not exist in the
      ; table, and read the row otherwise.
      ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#with-read
      ;
      ; Note that when using (with-read) it is not necessary to bind variables
      ; to every column in the table. You can just use the columns you want.
      (with-read accounts account { "request-limit" := old-request-limit }
        (enforce (> new-limit old-request-limit)
          (format "The new request limit {} must be a value greater than the old limit ({})" [ new-limit, old-request-limit ]))

        ; We used (write) before because we were inserting a new row into the
        ; table if the account didn't yet exist. To update one or more columns
        ; in an existing row you can use (update):
        ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#update
        ;
        ; Like (with-read), it's only necessary to include the columns that you
        ; are updating, not all the columns.
        (update accounts account { "request-limit": new-limit }))))

  ; The set-account-limit function is almost identical to the set-request-limit
  ; function, just targeting a different field, so it is uncommented.
  (defun set-account-limit:string (account:string new-limit:decimal)
    @doc "Set a new per-account limit for requesting funds from the faucet."
    @model
      [ (property faucet-authorized)
        (property (= new-limit (at "account-limit" (read accounts account "after"))))
      ]

    (with-capability (SET_LIMIT)
      (with-read accounts account { "account-limit" := old-account-limit }
        (enforce (> new-limit old-account-limit)
          (format "The new account limit {} must be a value greater than the old limit ({})" [ new-limit, old-account-limit ]))
        (update accounts account { "account-limit": new-limit }))))

  ; Our next function is a little helper that lets users look up their account
  ; limits from our table. Remember: tables cannot be accessed outside your
  ; module for security reasons. If you want to provide access to specific data,
  ; write a function that performs the table read.
  (defun get-limits:object (account:string)
    @doc "Read the limits for your account and see how much KDA you can request."
    (with-read accounts account { "account-limit" := account-limit, "request-limit" := request-limit, "funds-requested" := requested, "funds-returned" := returned }
      { "account-limit": account-limit
      , "request-limit": request-limit
      , "account-limit-remaining": (- account-limit (- requested returned))
      }
    ))

  ; Our final function allows users to transfer funds back to the faucet account
  ; and credit it against their account limit. The property tests, enforcements,
  ; table reads and writes, and let bindings should start looking familiar!
  (defun return-funds:string (account:string amount:decimal)
    @doc "Return funds to the faucet (returned funds credit against your limits)."
    @model
      [ (property (> amount 0.0))
        (property (= amount (column-delta accounts "funds-returned")))
      ]
    (enforce (> amount 0.0) "Amount must be greater than 0.0")
    (with-read accounts account { "funds-requested" := requested, "funds-returned" := returned }
      (let ( (balance (- requested returned)) (new-returned (+ returned amount)) )
        ; We didn't implement a property for this because our table invariants
        ; already verify that the funds returned can never exceed the funds
        ; requested. You can verify that removing this enforcement check will
        ; make the model checker yell at us.
        (enforce (<= amount balance)
          (format "{} exceeds the amount this account can return to the faucet, which is {}." [ amount balance ]))
        ; Next, we transfer from the user account to the faucet account. To
        ; transfer funds from the user to the faucet account the user must have
        ; signed the transaction and scoped their signature to the
        ; (coin.TRANSFER) capability. For examples, please see the faucet.repl
        ; file and the return-funds.yaml request file.
        (coin.transfer account FAUCET_ACCOUNT amount)
        (update accounts account { "funds-returned": new-returned }))))
)

; ----------
; INITIALIZATION
; ----------
;
; At this point we've established our smart contract: we entered a namespace,
; defined a keyset, and implemented a module. Now it's time to initialize data.
;
; For a typical smart contract, that simply means creating any tables we defined
; in the contract. However, more complex contracts may perform other steps, such
; as calling functions from the module.
;
; Tables are defined in modules, but they are created after them. This ensures
; that the module can be redefined (ie. upgraded) later without necessarily
; having to re-create the table.
;
; Speaking of: it's a common practice to implement the initialization step as an
; if statement that differentiates between an initial deployment and an upgrade.
; As with our keyset definition at the beginning of the contract, this can be
; done by sending an "init" field with a boolean value as part of the
; transaction data
(if (read-msg "init")
  (create-table free.goliath-faucet.accounts)
  "Upgrade complete")
