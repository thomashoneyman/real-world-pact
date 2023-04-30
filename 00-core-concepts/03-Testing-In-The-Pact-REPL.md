# Testing and Formal Verification in the Pact REPL

Smart contracts are notoriously difficult to secure. Vulnerabilities in smart contracts have contributed to [billions of dollars in total losses](https://rekt.news/leaderboard) across the web3 ecosystem over the past few years. The blockchain environment is a harsh one: smart contracts can be read and executed by anyone and they manage sensitive data like account balances and asset ownership. Mistakes are easy to make and easy to find and exploit. A bad one can produce enormous financial losses and end a project altogether.

The Pact programming language is designed for security. Some design decisions remove (or at least obstruct) potential footguns like [re-entrancy attacks](https://hackernoon.com/hack-solidity-reentrancy-attack) and infinite loops. Others give the language extra power not found in other languages, such as being able to formally verify your code, which is much better than unit tests alone. If your smart contract is for a real application and will be handling sensitive data you should also considera security audit. An audit can catch subtle but critical issues in contracts — such as [this convoluted but (technically) possible vulnerability in a Pact contract](https://www.certik.com/resources/blog/1eFmMTGVicfAMiPka3vaTY-cross-function-reentrancy-attacks-in-kadena-smart-contracts).

Most issues, however, can be caught with a combination of unit tests, typechecking, and formal verification. Unit tests are written in Pact REPL files, while types and formal verification are written into your Pact modules directly and are then executed in the Pact REPL. Pact provides many REPL-only functions that help you write tests, benchmark your code, predict gas consumption, simulate different blockchain states, and more.

Before we begin: this article was written with Pact 4.6. If you are a Nix user then you can get the same version of Pact in your shell from [pact-nix](https://github.com/thomashoneyman/pact-nix) with one of the following commands:

```console
# To temporarily drop directly into the Pact interpreter
$ nix run github:thomashoneyman/pact-nix#pact-4_6_0
pact>

# To temporarily get Pact in your shell
$ nix develop github:thomashoneyman/pact-nix#pact-4_6_0
$ pact --version
pact version 4.6
```

Otherwise, see [the Pact GitHub repository](https://github.com/kadena-io/pact) for installation instructions. Once installed, you can execute a Pact REPL file with the command `pact test-file.repl` or you can load a file to play around with interactively by entering the REPL and then running `(load "test-file.repl")`.

## Unit Testing in the Pact REPL

Pact supplies three basic functions for implementing unit tests in the REPL: `expect`, `expect-that`, and `expect-failure`.

The `expect` function is a simple equality check that reports an error if the two provided expressions are not equal to one another.

```console
pact> (expect "1 equals 1" 1 1)
"Expect: success: 1 equals 1"

pact> (expect "1 does not equal 2" 1 2)
"FAILURE: 1 does not equal 2: expected 1:integer, received 2:integer"

pact> (expect "different lists" [1] [2])
"FAILURE: different lists: expected [1]:[<a>], received [2]:[<b>]"

pact> (expect "different objects" { 'a': 1 } { 'a': 2 })
"FAILURE: different objects: expected {"a": 1}:object:*, received {"a": 2}:object:*"
```

The `expect-that` function is similar, but it uses a predicate function instead of simple equality to perform its test. Accordingly, `expect-that` is a little more versatile than `expect` because you only have to assert a condition, not a specific value. In fact, you can express `expect` via `expect-that` by providing equality as the predicate function:

```console
pact> (expect-that "1 equals 1" (= 1) 1)
"Expect-that: success: 1 equals 1"
```

The `expect-that` function makes it easy to express a condition over a range of inputs. Below, we test a function to determine if a list is non-empty over a few inputs:

```console
pact> (map (expect-that "nonempty" (compose (length) (< 0))) [[] [1] [1 2]])
["FAILURE: nonempty: did not satisfy (compose (length) (< 0)): []:[<a>]"
"Expect-that: success: nonempty"
"Expect-that: success: nonempty"]
```

We got three lines of output here because we ran this interactively. However, if we put the same code into a REPL file...

```clj
; test.repl
(map (expect-that "nonempty" (compose (length) (< 0))) [[] [1] [1 2]])
```

...and then we execute that REPL file, you'll find that only the errors are printed:

```console
$ pact pact.repl
pact.repl:1:5: FAILURE: not empty: did not satisfy (compose (length) (< 0)): []:[<a>]
Load failed
```

This is a useful bit of output filtering. You'll also see that the process exited with a failure status code (1), whereas if we remove the empty list and run this again we'll see a successful output with a success status code (0):

```console
$ pact pact.repl
Load successful

$ echo $?
0
```

The third and final unit testing function provided for use in the Pact REPL is `expect-failure`. This function takes a single expression and expects it to throw an error — for example, because the function contains a call to `enforce` that should fail — and fails only if the provided function succeeds. It's useful for when you know some inputs to a function that definitely should not work.

```console
pact> (expect-failure "Enforce should throw on false" (enforce false "Uh oh"))
"Expect failure: success: Enforce should throw on false"
```

You can optionally include the error message you expect to see; if the thrown error does not contain that message, then `expect-failure` will fail. This helps you verify that the error message you expect users to see when they call your contract code incorrect. Below, our provided expression throws as expected, but the error message is wrong.

```console
pact> (expect-failure "Enforce should say 'Oh no'" "Oh no" (enforce false "Uh oh"))
"FAILURE: Enforce should say 'Oh no': expected error message to contain 'Oh no', got '(enforce false "Uh oh"): Failure: Tx Failed: Uh oh'"
```

Let's say we're developing a smart contract with a few functions for working with lists. We can put this in a file named `lists.pact`:

```clj
(module lists GOV
  (defcap GOV () true)

  (defun empty (xs)
    "Check if a list is empty."
    (= (length xs) 0))

  (defun enforce-nonempty (xs)
    "Enforce that a list is not empty."
    (enforce (not (empty xs)) "List can't be empty."))

  (defun head (xs)
    "Get the first item in a list."
    (enforce-nonempty xs)
    (at 0 xs))

  (defun safe-head (xs default)
    "Get the first item in a list, or return the default if it is empty."
    (if (empty xs) default (head xs)))

  (defun snoc (xs a)
    "Append a value to the end of a list"
    (+ xs [a]))
)
```

Let's write a few unit tests in a REPL file named `lists.repl`:

```clj
; First we need to load the module code we want to test. It's a good
; practice to wrap this in (begin-tx) and (commit-tx) so that we don't
; automatically have governance privileges for the module.
(begin-tx)
(load "lists.pact")
(commit-tx)

; We have to refer to functions qualified by the module name — such as
; 'lists.empty', 'lists.snoc' — unless we use (use) to bring the full
; module into scope.
(use lists)

; Next, we can test that our functions behave as expected. We'll start
; with some simple 'expect' and 'expect-that' calls. These should all
; succeed.
(expect-that "Empty list is empty" (empty) [])
(expect "List with values is not empty" false (empty [1]))
(expect "First elem is 1" 1 (head [1]))
(expect "Safe head falls back to default" 1 (safe-head [] 1))
(expect "Appends to end of list" [1 2 3] (snoc [1 2] 3))

; Notice that we tested that (empty [1]) was equal to 'false' instead of
; using (expect-failure). That's because (expect-failure) only fails if
; the expression throws an error. Returning 'false' is considered fine.
(expect-failure "Cannot use head on empty list" (safe-head []))
(expect-failure "Enforce nonempty on empty lists" (enforce-nonempty []))
```

If we then run this file at the command line we should see all tests pass:

```console
$ pact lists.repl
Load successful
```

I encourage you to take a moment to write other list functions and tests for them. For example:

- Write and test a function `last` that gets the last item from a list. What happens if the list is empty? Can you write a `safe-last` that can work on empty lists by returning a default value?
- Write and test a function `occurrences` that counts how many times an item is seen in a list, returning `0` if the item is not in the list.
- Write and test a function `flatten` that takes a list of lists and flattens them into a single list by concatenating them all together.

## Testing Transactions, Capabilities, and Signatures

The `expect` family of functions are wonderful for testing Pact functions based on their inputs and outputs, including those which use `enforce` internally. However, since Pact is a smart contract language, many Pact functions can only be tested in the context of a specific transaction and its digital signatures. The Pact REPL supplies several functions for simulating transactions.

The `env-data` function allows you to attach an object to a transaction. This should be used when a contract uses the `read` family of functions to read a transaction payload. The data object can either contain JSON-encoded values or it can contain Pact code directly.

```console
pact> (read-integer "my-int")
<interactive>:0:0: No such key in message: my-int
 at <interactive>:0:0: (read-integer "my-int")

pact> (env-data { "my-int": 1 })
"Setting transaction data"

pact> (read-integer "my-int")
1
```

The `env-sigs` function allows you to attach digital signatures to a transaction. Each signature can be scoped to a specific capability, which means the signature is valid only for that capability and not others. The `env-sigs` function takes an array of keys and associated capabilities, which represents the transaction being signed with the private key associated with the indicated public key.

```console
pact> (env-sigs [ { "key": "my-public-key" }, "caps": [] } ])
```

With these two functions in hand we are able to simulate transactions in the REPL and test Pact code that depends on the transaction payload and/or digital signatures. To demonstrate, let's write another tiny module, this time in `caps.pact`:

```clj
(module caps GOV
  (defcap GOV () (enforce false "No upgrades."))

  (defcap INTERNAL () true)

  (defcap ALICE () (enforce-keyset "free.alice-keyset"))

  (defcap SHARED () (enforce-keyset "free.shared-keyset"))

  (defun internal-fn ()
    (require-capability (INTERNAL))
    "Internal only!")

  (defun public-fn ()
    (with-capability (INTERNAL)
      (internal-fn)))

  (defun alice-fn ()
    (with-capability (ALICE)
      "Alice signed!"))

  (defun shared-fn ()
    (with-capability (SHARED)
      "All parties signed!"))
)
```

There are a few interesting things going on here.

First, we use the `INTERNAL` capability as a way to designate functions that should not be callable from outside the module. The only way to acquire a capability is via `(with-capability CAP ...)` used within the module (or with governance rights), so even though `INTERNAL` can be trivially granted, no one can acquire it without going through some function in this module. In our case, we'll see that we can't call `internal-fn` ourselves, but we _can_ call `public-fn`.

Second, the `alice-fn` and `shared-fn` functions attempt to acquire the `ALICE` and `SHARED` capabilities, respectively. However, both capabilities use the `enforce-keyset` function to verify that the digital signatures indicated by a particular keyset are satisfied before the capability can be granted. This is how you can ensure a transaction can only go through if signed by specific keys. We'll refer to permanent keychain references here, but you can also store keysets in databases.

Before we can start writing tests we need to simulate registering the keysets our module relies on on-chain. To do _that_ we need to be in a namespace, so let's pause for a quick bit of setup. Put the below code in a file named `caps-setup.repl`:

```clj
; First we register the 'free namespace, which already exists on Chainweb
; but which we must create in the REPL
(begin-tx)
(env-data { "admin-keyset": ["admin-pubkey"] })
(env-sigs [{ "key": "admin-pubkey", "caps": [] }])
(define-namespace 'free (read-keyset 'admin-keyset) (read-keyset 'admin-keyset))
(commit-tx)

; Then, we'll register the alice-keyset and shared-keyset. The former requires
; Alice's signature, and the latter requires both Alice and Bob's signatures.
(begin-tx)
(env-data {
  "alice-keyset": { "keys": ["alice-pubkey"], "pred": "keys-all" },
  "shared-keyset": { "keys": ["alice-pubkey", "bob-pubkey"], "pred": "keys-all" }
})

; We can enter our namespace, define the keysets needed for our module, and then
; load the module.
(namespace 'free)
(define-keyset "free.alice-keyset" (read-keyset "alice-keyset"))
(define-keyset "free.shared-keyset" (read-keyset "shared-keyset"))
(load "caps.pact")

; Before we commit we should clear out the transaction data and signatures so
; our tests begin with a clean slate.
(env-data {})
(env-sigs [])
(commit-tx)
```

It's common to have a convenience file like this to set up your REPL session. You can then load it into your actual test file. Let's go ahead and write our test file under the assumption our module has been loaded.

In our tests we would like to verify that our `internal-fn` cannot be called outside the module, that `public-fn` can be, and that `alice-fn` and `shared-fn` are only callable if signatures exist on the transaction that satisfy their respective keysets.

```clj
(load "caps-setup.repl")
(use free.caps)

(expect-failure "Cannot call internal function." (internal-fn))
(expect "Can call via public function." "Internal only!" (public-fn))

(expect-failure
  "Cannot call Alice-only function without her signature."
  (alice-fn))

(env-sigs [ { "key": "alice-pubkey", "caps": [ (ALICE) ] } ])
(expect
  "Can call Alice-only function if Alice signs."
  "Alice signed!"
  (alice-fn))

(expect-failure
  "Cannot call shared function without both signatures."
  (shared-fn))

(env-sigs [
  { "key": "alice-pubkey", "caps": [ (ALICE) ] },
  { "key": "bob-pubkey", "caps": [ (ALICE) ] }
])
(expect-failure
  "Cannot call multi-sig function with wrong capability."
  (shared-fn))

(env-sigs [
  { "key": "alice-pubkey", "caps": [ (SHARED) ] },
  { "key": "bob-pubkey", "caps": [ (SHARED) ] }
])
(expect
  "Can call multi-sig function with sigs & caps."
  "All parties signed!"
  (shared-fn))
```

## Static Type Checking & Formal Verification in Pact

Pact provides two ways to machine-check your code: static types and formal verification.

Static type-checking helps you verify that your module never uses a value of one type when another is required (such as providing an `integer` to the `length` function, which requires a list). Most (but not all) errors caught by the type checker would throw an exception at runtime, but in the smart contract world you certainly don't want to wait until then!

You can ask Pact to check your types are correct for any module with the `typecheck` REPL-only function, which takes the name of the module to check as its argument. As a brief example (this will not actually work, since we haven't implemented a `my-module.pact`):

```console
pact> (load "my-module.pact")
Loaded module my-module, ...

pact> (typecheck "my-module")
"Typecheck my-module: success"
```

We won't spend much time on type checking because it is also included in formal verification. In short, I recommend that you provide type annotations in your code wherever possible so that Pact can help ensure you don't make a mistake.

Formal verification is one of my favorite Pact features. It's a way to mathematically prove that a program works as intended. First you express a property that must be true of some code for all possible states that code can be in. Then, the Pact property checking system tries all possible inputs for that code to find a code path that produces an invalid state. If one can be found then the verifier will tell you the exact function calls and arguments that led to the bug. Pact's system is built on Microsoft's Z3 theorem prover.

You can verify a module as easily as you typechecked it (again, this will not actually work, since we haven't implemented a `my-module.pact`):

```console
pact> (load "my-module.pact")
Loaded module my-module, ...

pact> (verify "my-module")
"Verification of my-module succeeded"
```

The best way to learn the Pact property checking system is via the quite good [docs in the Pact language reference](https://pact-language.readthedocs.io/en/stable/pact-properties.html#what-is-it). You should read it! However, if that's a bit too much all at once, we can start with a few minimal examples so you can recognize the system when you see it in Pact contracts in the wild.

To use the Pact property checking system you must have [z3 installed and available in your shell](https://github.com/Z3Prover/z3). If you don't have z3 already and have been following along with Nix, you can add z3 temporarily to your shell with the following command:

```console
$ nix-shell -p z3
```

Let's write some properties! We can define properties via the `@model` metadata form. Within functions we can use `property` to indicate a property that must hold true if the transaction succeeds. Within schema definitions we can use `invariant` to indicate a property that must hold true for the fields of the schema. You can see the [language reference](https://pact-language.readthedocs.io/en/stable/pact-properties-api.html) for a list of usable property and invariant functions.

For the next short exercise, write the following module to the file `verifier.pact`. It contains a basic transfer function and underlying table. The transfer function specifies some properties that must hold true, and we've used some enforcements to rule out potential bugs, but there's still a bug lurking in this code.

```clj
(module verifier GOV
  (defcap GOV () (enforce false "No upgrades."))

  (defschema account
    @model [
      ; An account should never have a negative balance.
      (invariant (>= balance 0.0))
    ]

    balance:decimal
    auth:guard)

  (deftable accounts:{account})

  (defun transfer (from:string to:string amount:decimal)
    @model [
      ; A transfer should never create new money — the table should
      ; contain the same total balance before and after.
      (property (= (column-delta accounts 'balance) 0.0))

      ; You cannot send funds unless you satisfy the guard associated
      ; with that account. Without this, you could send others' money.
      (property (row-enforced accounts "auth" from))
    ]

    (enforce (!= from to) "Cannot send to yourself.")
    (enforce (> amount 0.0) "Cannot send negative funds".)
    (with-read accounts from { "balance" := from-funds, "auth" := auth }
      (enforce-guard auth)
      (with-read accounts to { "balance" := to-funds }
        ; First we debit funds from the sender
        (update accounts from { "balance": (- from-funds amount) })
        ; Then we credit funds to the receiver
        (update accounts to { "balance": (+ to-funds amount) }))))
)
```

We can then load this into the Pact REPL and verify it:

```console
pact> (load "verifier.pact")
pact> (verify "verifier")
```

Uh oh! z3 is able to locate a violation of our invariant that an account can never have a negative balance. It tells us the violated property was on line 7, and the error occurred within the `transfer` function. Let's take a look:

```console
verifier.pact:7:17:OutputFailure: Invalidating model found in verifier.transfer
  Program trace:
    entering function verifier.transfer with arguments
      from = "W"
      to = "r"
      amount = 0.2
```

We begin with the arguments z3 provided to our function. Next, z3 walks through our code step-by-step. It steps through both our `enforce` calls and sees that they pass:

```console
      satisfied assertion: = from to) "C
      satisfied assertion:  amount 0.0) "C
```

Next, we have our database reads and enforcement of the auth guard:

```console
      read { auth: 4, balance: 0.1 } from accounts at key "W" succeeds
      destructuring object
        from-funds := 0.1
        auth := 4
        satisfied guard from database
        read { balance: 0.1 } from accounts at key "r" succeeds
        destructuring object
          to-funds := 0.1
```

The sender "W" has a balance of 0.1 and the receiver "r" has a balance of 0.1. Next, the database updates happen:

```console
          update accounts at key "W" with { balance: -0.1 } succeeds
          update accounts at key "r" with { balance: 0.3 } succeeds
```

Uh oh! There's the bug. The user "W" only has a balance of 0.1 but has sent 0.2, which produces a negative balance. This transaction should fail, but our current code allows it. z3 reaches the end of the transaction without a problem:

```console
      returning with "Write succeeded"
```

Try fixing the problem by adding another `enforce`. Once fixed, reload and re-verify your module. You can now be more confident your code is correct!

## Measuring Gas Consumption

We've learned the fundamentals of testing the correctness of Pact code in the REPL. But correctness is not the only important consideration for your code. Recall that either you or your users will have to pay, in the form of gas fees, for your smart contract code to be executed. The lower the gas consumption of your contract the cheaper it is to use for you or your users.

Let's start a new REPL session and explore the gas costs of a few common functions.

You can enable gas logging by setting a gas model via `env-gasmodel` (defaults to a fixed 0 gas per operation) and a gas limit via `env-gaslimit` (defaults to a limit of 0 gas). It's a common practice to use the "table" gasmodel in which the interpreter provides estimates and either an enormous gas limit (you don't care about the limit), or a limit of 180,000 (the maximum a transaction can consume), or a limit of what you feel is reasonable for your transaction.

```console
pact> (env-gasmodel "table")
"Set gas model to table-based cost model"

pact> (env-gaslimit 180000)
"Set gas limit to 180000"
```

Once you have set a gas model and limit you can use the `env-gas` function to set or read the amount of gas consumed. For example, it is common to set gas to 0 with `(env-gas 0)`, run a function, and then read how much gas was consumed with `(env-gas)`.

```console
pact> (env-gas 0)
"Set gas to 0"
pact> (+ 1 2)
3
pact> (env-gas)
1
```

From this short session we can deduce that simple addition costs a single unit of gas. Let's explore a few more functions — from here, I will only include the gas output from the REPL to keep things concise.

How much do various math operations cost?

```console
pact> (env-gas 0) (- 3 4) (env-gas)
1

pact> (env-gas 0) (* 2 3) (env-gas)
3

pact> (env-gas 0) (/ 2 3) (env-gas)
3

pact> (env-gas 0) (^ 2 3) (env-gas)
4

pact> (env-gas 0) (shift 1 3) (env-gas)
1
```

We can see that basic arithmetic is extremely cheap. Addition and subtraction costs a single unit of gas; multiplication and division cost 3; exponentiation costs 4. Bit-shifting costs 1 unit. These numbers grow

How about a more complicated function like `fold`?

```console
pact> (env-gas 0) (fold (+) 0 []) (env-gas)
3

pact> (env-gas 0) (fold (+) 0 [1]) (env-gas)
4

pact> (env-gas 0) (fold (+) 0 [1 2]) (env-gas)
5
```

Folding a list incurs 3 gas for the basic operation and then the cost of your accumulation function for each item in the list. How much gas do you think each example above would cost if we had multiplied instead of adding items together? Try it in the REPL!

It is critical to measure the gas consumption of your smart contract functions. Some calls can surprise you — for example, reading the keys of a totally empty table still costs a _ton_ of gas. Paste this module into the REPL:

```console
(module test GOV
  (defcap GOV () true)

  (defschema row-type age:decimal)

  (deftable table:{row-type})
)
(create-table table)
```

Then, check the gas consumption of reading the table's keys:

```console
pact> (env-gas 0) (keys table) (env-gas)
40000
```

The `keys` function always costs 40,000 units of gas. This massive gas consumption is a penalty used to discourage the use of functions like `keys` in transactional code. After all, tables can end up recording massive amounts of data, in which case reading all rows requires a ton of computation.

Instead, you are meant to use `keys` and functions like it only in local requests, which don't cost any gas and aren't broadcast to the network. This isn't always obvious when you're reading the language documentation or others' code, so I recommend that you always check the gas consumption of your smart contract functions before deploying them.

## Wrapping Up

You've made it to the end of the Pact Core Concepts series! You're now well-equipped to read Pact code you find in the wild and write some of your own. Still, it will take time for the concepts to become familiar.

I encourage you to begin writing your own small smart contracts. As you do, you can use the projects in [Real World Pact](https://github.com/thomashoneyman/real-world-pact) as examples of real-world code ranging from beginner to advanced. The Real World Pact repository also demonstrates how to deploy your contracts to Chainweb, interact with contracts that exist on-chain, and write a frontend for your smart contract backend.
