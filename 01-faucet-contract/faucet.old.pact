; This contract implements the Goliath faucet. The faucet allows anyone to
; request a small amount of KDA for testing purposes (it should not be deployed
; to a real-world environment such as Chainweb). This contract demonstrates
; basic smart contract development with Pact. Here's how it works:
;
;   1. Anyone can request KDA from the faucet account via this contract.
;   2. No request can exceed the per-request limit, which is set by the
;      'goliath-faucet to any value between 20 and 200 KDA.
;   3. No account can exceed the per-account total limit, which is set by the
;      'goliath-faucet account to any value between 100 and 1000 KDA.
;   4. An account can return funds to the faucet, which will credit against
;      the per-account limit for that account. Note: the account *must* use the
;      (return-funds) function to send the funds or they will not be credited.
;
; While the faucet contract is quite small, it still demonstrates many of the
; fundamental Pact features you will find in real-world contracts deployed to
; Chainweb. This thoroughly-commented contract is accompanied by a test REPL
; file that can be used for interactive tests, measuring gas consumption,
; and formal verification. It is also accompanied by a collection of request
; files that you can use to deploy this contract to a local Chainweb node
; running devnet and then make real-world requests to it.

; --------------------
; Goliath Faucet
; --------------------

; Welcome to the Goliath faucet smart contract!
;
; Smart contracts on Kadena are written in the Pact language. In a contract, you
; typically will define one or more keysets, enter a namespace, write a module
; and/or interface, and then initialize the contract (for example, by creating
; any tables you defined in your module). Each of these steps introduces
; critical concepts for Pact development, so let's briefly explore each one.

; ----------
; KEYSETS
; ----------

; Public-key authorization is widely used in smart contracts to ensure that only
; the holders of specific keys can take certain actions (such as transferring
; funds from their account). Pact integrates single- and multi-signature public-
; key authorization into smart contracts directly via the concept of "keysets".
; Pact has other tools for authorization as well; as a whole, authorization in
; Pact is handled via "guards" or "capabilities" (we'll learn about both later),
; and a keyset is a specific kind of guard.
;
; So what, exactly, is a keyset? A keyset pairs a set of public keys with a
; predicate function. In JSON form it looks like this:
;   { "keys": [ "abc123"], "pred": "keys-all" }
;
; Pact will check the predicate function against the set of keys when the keyset
; is used as a guard. If the predicate fails then access is denied. There are
; a few built-in predicate functions, such as the "keys-all" function above;
; this predicate means means that all keys in the set must have signed the
; transaction. You can also write your own predicate functions (for example,
; to authorize access according to a vote).
; https://pact-language.readthedocs.io/en/latest/pact-reference.html#keysets-and-authorization
;
; Keysets are defined via the (define-keyset) function. This function takes a
; name and a keyset as arguments. When evaluated, Pact will either register the
; keyset at the given name on Chainweb or, if the name is already registered,
; then it will "rotate" the keyset to the new value. Keyset updates are guarded
; by the existing keyset; if the existing keyset predicate function isn't
; satisfied then the update will fail. You can refer to a particular keyset by
; name once it has been registered on Chainweb.
; https://pact-language.readthedocs.io/en/stable/pact-functions.html#define-keyset
;
; Let's define our own keyset. By supplying our admin account public key we can
; restrict sensitive operations in our smart contract to only our admin account.
; It's common practice to provide the keyset as part of the transaction data
; instead of hardcoding it into the contract because keysets can be rotated;
; you can read a key from the transaction payload and parse it as the 'keyset'
; type using the (read-keyset) function:
; https://pact-language.readthedocs.io/en/stable/pact-functions.html#read-keyset
;
; Below, we register the name "goliath-faucet-keyset" with the keyset read from
; the transaction data at the key "goliath-faucet-keyset". Now our Pact module
; can refer to the "goliath-faucet-keyset" when guarding sensitive information.
(define-keyset "goliath-faucet-keyset" (read-keyset "goliath-faucet-keyset"))

; Before we move on, we should verify our keyset definition. There are multiple
; reasons to do this. First, what if we have a typo in the keyset we provided in
; the transaction data? We'll lose access to anything guarded with the keyset!
; Second, you don't have to define a keyset inside your smart contract. For
; example, what if we  want to reuse a keyset across multiple contracts? We
; don't want to redefine it in each contract, so we instead can just refer to it
; by name. This can be dangerous, however. If you deploy a contract referring to
; a keyset but you forgot to register that keyset, then someone else can
; register the keyset with their keys and gain access to your guarded data.
;
; To prevent these risks it's a best practice to enforce a keyset guard on the
; transaction that deploys the contract, using any keysets referenced in the
; contract. For example, we are defining and using the "goliath-faucet-keyset"
; keyset. We can enforce that the deployment transaction itself satisfies this
; keyset by looking up the newly-registered keyset and enforcing it. If this
; fails, the deployment is aborted.
; https://pact-language.readthedocs.io/en/stable/pact-functions.html#keyset-ref-guard
(enforce-guard (keyset-ref-guard "goliath-faucet-keyset"))

; ----------
; NAMESPACES
; ----------

; Modules and interfaces in Pact must have unique names within a particular
; namespace. On a private blockchain you can define your own namespace or use
; the "root" namespace (ie. no namespace at all). On a public blockchain the
; root namespace is reserved for built-in contracts (like the `coin` contract,
; which we'll see later), and on Chainweb specifically you can only define a
; new namespace with the approval of the Kadena team.
;
; In short, we technically can define a namespace with (define-namespace) in our
; contract but, practically speaking, we can't do this on Chainweb. So we can't
; define a namespace, and we can't use the root namespace. What are we to do?
;
; Chainweb exposes two namespaces for public use: `free` and `user`. You can
; define interfaces and modules inside either of these two interfaces. To do
; that, you first "enter" the namespace with the (namespace) function:
; https://pact-language.readthedocs.io/en/stable/pact-functions.html#namespace
;
; We'll use the 'free' namespace for our contract:
(namespace "free")

; ----------
; INTERFACES
; ----------

; So far we've been writing code at the top level. Code at the top level is
; ordinary Pact that Chainweb can execute. However, when you are defining a new
; smart contract, you need to organize your Pact code into interfaces and/or
; modules so that it can be called. Chainweb will store your interfaces and
; modules within the namespace you've entered, and then other contracts and top-
; level Pact code can then call your code.
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
; as a blueprint for implementors.
;
; Also, Pact functions take a reference to module as an argument so long as the
; module implements a specific interface. That means you can write a function
; that can be used with any module that implements the given interface — a
; powerful form of abstraction.
; https://pact-language.readthedocs.io/en/stable/pact-reference.html#module-references
;
; For our contract, we'll declare an interface simply to guide the development
; of our module. Our interface will describe the API for our module and will
; include some helpful constants and formal verification models to ensure the
; module implementation is correct.
;
; We can declare an interface like this:
(interface goliath-faucet-interface

  ; Now, let's implement the body of our interface. It's a best practice to
  ; document interfaces, modules, functions, table schemas, and other Pact code
  ; using the @doc metadata field. We'll do that throughout our contract.
  ; https://pact-language.readthedocs.io/en/latest/pact-reference.html#docs-and-metadata
  @doc
    "Interface for the Goliath faucet contract. A compliant module should      \
    \implement the given functions to let the wallet send funds to users who   \
    \request them, with the restriction that:                                  \
    \                                                                          \
    \  - No request can exceed the per-request limit, which is set by the      \
    \    'goliath-faucet account to a value between 20 and 200 KDA.            \
    \  - No account can exceed the per-account limit, which is set by the      \
    \    'goliath-faucet account to a value between 100 and 1000 KDA."

  ; --------------------
  ; Constants
  ; --------------------

  ; It's useful to define constants in your interface for values that will be
  ; used in several functions, or values that other modules should be able to
  ; refer to.
  ;
  ; Our faucet contract has a specific range of values that it will allow the
  ; per-request and per-account limits to be set to. It's useful to capture
  ; these values in variables that our tests, module code, and other modules on
  ; Chainweb can refer to. To expose a constant value, use `defconst`:
  ; https://pact-language.readthedocs.io/en/latest/pact-reference.html#defconst
  (defconst FAUCET_ACCOUNT:string "goliath-faucet"
    @doc "Account name of the faucet that holds and transfers funds.")

  (defconst REQUEST_LIMIT_MIN:decimal 20.0
    @doc "Users can at minimum ask for up to 20 KDA per request.")

  (defconst REQUEST_LIMIT_MAX:decimal 200.0
    @doc "Users can at maximum ask for up to 200 KDA per request.")

  (defconst ACCOUNT_LIMIT_MIN:decimal 100.0
    @doc "Users can at minimum ask for up to 100 KDA for their account.")

  (defconst ACCOUNT_LIMIT_MAX:decimal 1000.0
    @doc "Users can at maximum ask for up to 1000 KDA for their account.")

  ; --------------------
  ; Table Schemas
  ; --------------------

  ; When your smart contract needs to persist some data across multiple calls to
  ; functions in the contract, it should use a table. Tables in Pact are
  ; relational databases and have a key-row structure. Keys are always strings.
  ; You can define a table with `deftable`:
  ; https://pact-language.readthedocs.io/en/stable/pact-reference.html#deftable
  ;
  ; Our smart contract needs to persist three pieces of data. First, we need to
  ; record how much KDA in total each account has received so that we know when
  ; a request would exceed the per-account limit. We also need to record the
  ; per-request and per-account limits, as they can be adjusted by the faucet
  ; account at any time.
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
  ; We are going to use two tables:
  ;
  ;  - The 'accounts' table will use accounts as keys and will record the total
  ;    funds requested by that account over the lifetime of the contract, minus
  ;    any funds returned by the account.
  ;
  ;  - The 'limits' table will use limit identifiers as keys and will record the
  ;    current limit amount.
  (defschema accounts-schema
    @doc
      "Schema for the 'accounts' table, which records funds requested by and   \
      \returned by individual accounts on Chainweb."

    ; Now we can define our table columns. We'll associate two pieces of data
    ; with a given account: the amount of KDA they've requested and the amount
    ; of KDA they've returned.
    funds-requested:decimal
    funds-returned:decimal)

  (defschema limits-schema
    @doc
      "Schema for the 'limits' table, which records the current per-account    \
      \and per-request limits imposed by the faucet contract."

    ; So far we have only used one of the metadata fields available in Pact:
    ; the @doc field. Another is @model, and it allows us to specify properties
    ; and invariants about our code. Pact, via Microsoft's Z3 theorem prover,
    ; can prove that there is no possible set of variable assignments in our
    ; code that will violate the given property or invariant. Or, if it does
    ; find a violation, it can tell us so we can fix it!
    ; https://pact-language.readthedocs.io/en/stable/pact-properties.html
    ; https://pact-language.readthedocs.io/en/stable/pact-properties.html#what-do-properties-and-schema-invariants-look-like
    ;
    ; Properties and invariants are defined the same way, but properties are
    ; used in functions and invariants are used in table schemas. Only some
    ; Pact functions are available when defining properties and invariants, and
    ; invariants only support a subset of the functions properties do. You can
    ; see the full list here:
    ; https://pact-language.readthedocs.io/en/stable/pact-properties-api.html#property-and-invariant-functions
    ;
    ; The faucet account should be able to raise the per-request and per-
    ; account limits, but it should not be able to lower them below their
    ; default values. We can assert that it should never be possible for these
    ; limits to fall below their default values, and Pact will formally verify
    ; that our contract code eliminates this possibility.
    @model [
      (invariant (and (>= ACCOUNT_LIMIT_MIN account-limit) (<= ACCOUNT_LIMIT_MAX account-limit)))
      (invariant (and (>= REQUEST_LIMIT_MIN request-limit) (<= REQUEST_LIMIT_MAX request-limit)))
    ]

    account-limit:decimal
    request-limit:decimal)

  ; -----------
  ; FUNCTIONS
  ; -----------

  ; The faucet module code must implement all of the functions specified in this
  ; interface. Let's specify them one-by-one.

  ; Our first function is an admin-only action to change the per-account limit
  ; for requsting funds from the faucet account. We are going to leverage Pact's
  ; formal verification system to determine certain properties and behaviors our
  ; function must satisfy when implemented. For example: this function should
  ; only be callable by the faucet account, this function must update the limits
  ; table, and the new limit must be within the range of the ACCOUNT_LIMIT_MIN
  ; and ACCOUNT_LIMIT_MAX.
  ;
  ; Pact's formal verification will tell us if our implementation fails to
  ; satisfy any of these properties.
  (defun update-account-limit:string (amount:decimal)
    @doc "Set a new per-account total limit for requesting funds from the faucet."
    @model [
      ;  ; This property verifies that this function can only be called within a
      ;  ; transaction signed by the faucet account keyset.
      ;  (property (authorized-by "goliath-faucet-keyset"))

      ; This property verifies that the account limit can only ever be set to an
      ; acceptable value within our contract's specified range.
      ;  (property (and (>= 100.0 amount) (<= 1000.0 amount)))
    ])

  ; Our second function adjusts the per-request limit. It's quite similar to the
  ; previous function.
  (defun update-request-limit:string (amount:decimal)
    @doc "Set a new per-request limit for requesting funds from the faucet."
    @model [
      ;  (property (authorized-by "goliath-faucet-keyset"))
      ;  (property (and (>= 20.0 amount) (<= 200.0 amount)))
      ;  (property (column-written limits-table "request-limit"))
    ])

  ; Our third function is the most important one in the contract. It allows
  ; anyone to request that funds are sent to a particular account. The request
  ; must include a guard (ie. a keyset) that is expected to govern the receiver
  ; account. If the receiver doesn't exist it will be created with the given
  ; guard.
  (defun request-funds:string (receiver:string receiver-guard:guard amount:decimal)
    @doc
      "Request that funds are sent to the account denoted as the 'receiver'. If\
      \the account does not exist then it will be created."

    @model [
      ; If this function succeeds then it must have incremented the accounts
      ; table at the row for the receiver by the correct ammount.
      (property (= amount (cell-delta accounts-table "funds-requested" receiver)))
    ])
)

; ----------
; MODULES
; ----------

; A module in Pact is the primary unit of organization for Pact code. Modules
; can contain functions, pacts, capabilities, tables, and other Pact code:
; https://pact-language.readthedocs.io/en/stable/pact-reference.html#module
;
; Let's define a Pact module with the code for our faucet. To define a module
; we must provide a module name, a module governance function, and then the
; module body containing the implementation.
;
; The module name is used to refer to the module from other modules (or in the
; REPL). For example, `coin.transfer` refers to the `transfer` function defined
; in the `coin` module. To refer to a module it must have been deployed to
; Chainweb (or loaded into the REPL, if you're in a Pact REPL). We'll name our
; module `goliath-faucet`. Since we're within the `free` namespace, that means
; we can refer to our module on Chainweb with the prefix `free.goliath-faucet`.
;
; The module governance function restricts how the contract can be upgraded.
; Governance functions can be a keyset reference, which means that the contract
; can be upgraded so long as the upgrade transaction satisfies the keyset, or
; they can be a "capability" defined in the module. We aren't using capabilities
; in our contract, but if you read the REPL file you'll see we use them there.
; https://pact-language.readthedocs.io/en/latest/pact-reference.html#keysets-vs-governance-functions
(module goliath-faucet "goliath-faucet-keyset"
  @doc
    "'goliath-faucet' represents the Goliath Faucet Contract. This contract    \
    \provides a small number of KDA to any Kadena user who needs some. To      \
    \request funds for yourself (Chain 0 only):                                \
    \  > (free.goliath-faucet.request-funds ...)                               \
    \                                                                          \
    \To return funds to the faucet account (Chain 0 only):                     \
    \  > (free.goliath-faucet.return-funds ...)"

  ; We should indicate early on that this module conforms to the interface we
  ; wrote earlier in our contract. We can do that with the (implements) builtin:
  ; https://pact-language.readthedocs.io/en/stable/pact-reference.html#implements
  (implements goliath-faucet-interface)

  ; ----------
  ; TABLES
  ; ----------

  ; Now, we'll begin implementing our module according to our interface. The
  ; interface includes schemas for a tables that it expects to exist in the
  ; module. We can define a table using this schema with (deftable):
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
  (deftable accounts-table:{goliath-faucet-interface.accounts-schema})
  (deftable limits-table:{goliath-faucet-interface.limits-schema})

  ; --------------------
  ; Functions
  ; --------------------

  ; Our interface also specified functions that must be implemented in our
  ; module. Functions are defined with (defun) and take a list of arguments and
  ; then a function body.
  ; https://pact-language.readthedocs.io/en/stable/pact-reference.html#defun
  (defun update-account-limit:string (amount:decimal)
    (with-default-read limits-table "limits" { "account-limit": goliath-faucet-interface.ACCOUNT_LIMIT_MIN, "request-limit": goliath-faucet-interface.REQUEST_LIMIT_MIN } { "account-limit" := account-limit, "request-limit" := request-limit }
      (enforce-guard (keyset-ref-guard "goliath-faucet-keyset"))
      (enforce (and (>= amount goliath-faucet-interface.ACCOUNT_LIMIT_MIN) (<= amount goliath-faucet-interface.ACCOUNT_LIMIT_MAX))
        (format "{} is not within the range of valid per-account limits ({} to {} KDA)" [ amount, goliath-faucet-interface.ACCOUNT_LIMIT_MIN, goliath-faucet-interface.ACCOUNT_LIMIT_MAX ]))
      (write limits-table "limits" { "account-limit": amount, "request-limit": request-limit })))

  (defun update-request-limit:string (amount:decimal)
    (with-default-read limits-table "limits" { "account-limit": goliath-faucet-interface.ACCOUNT_LIMIT_MIN, "request-limit": goliath-faucet-interface.REQUEST_LIMIT_MIN } { "account-limit" := account-limit, "request-limit" := request-limit }
      (enforce-guard (keyset-ref-guard "goliath-faucet-keyset"))
      (enforce (and (>= amount goliath-faucet-interface.REQUEST_LIMIT_MIN) (<= amount goliath-faucet-interface.REQUEST_LIMIT_MAX))
        (format "{} is not within the range of valid per-account limits ({} to {} KDA)" [ amount, goliath-faucet-interface.ACCOUNT_LIMIT_MIN, goliath-faucet-interface.ACCOUNT_LIMIT_MAX ]))
      (write limits-table "limits" { "request-limit": amount, "account-limit": account-limit })))

  (defun request-funds:string (receiver:string receiver-guard:guard amount:decimal)
    (with-default-read accounts-table receiver { "funds-requested": 0.0, "funds-returned": 0.0 } { "funds-requested" := funds-requested, "funds-returned" := funds-returned }
      (with-default-read limits-table "limits" { "account-limit": goliath-faucet-interface.ACCOUNT_LIMIT_MIN, "request-limit": goliath-faucet-interface.REQUEST_LIMIT_MIN } { "account-limit" := account-limit, "request-limit" := request-limit }
        (enforce (<= amount request-limit)
          (format "{} exceeds request limit, which is {}" [ amount request-limit ]))
        (let (( total (+ amount funds-requested) ))
          (enforce (<= total account-limit)
            (format "{} exceeds account limit, which is {}" [ total account-limit ]))
          (coin.transfer-create FAUCET_ACCOUNT receiver receiver-guard amount)
          (write accounts-table receiver { "funds-requested": total, "funds-returned": funds-returned })))))
)

; ----------
; INITIALIZATION
; ----------
;
; At this point we've established our smart contract: we defined keysets,
; entered a namespace, declared an interface, and implemented a module. Now,
; it's time to initialize data. For a typical smart contract, that simply means
; creating any tables we defined in the contract. However, more complex
; contracts may perform other steps, such as calling functions from the module.
;
; While tables are defined in modules, they are created after them. This ensures
; that the module can be redefined (ie. upgraded) later without necessarily
; having to re-create the table.
;
; Speaking of: it's a common practice to implement the initialization step as an
; 'if' statement that differentiates between an initial deployment and an
; upgrade. This is done by including an { "upgrade": boolean } field as part of
; the transaction data.
(if (read-msg "upgrade")
  (format "{}" [ "upgrade complete" ])
  ; In the case this is our initial deployment, we'll create the tables.
  [ (create-table free.goliath-faucet.accounts-table)
  , (create-table free.goliath-faucet.limits-table)
  ])
