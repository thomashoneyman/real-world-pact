# 2. Learn Pact in 20 Minutes

Pact is a wonderful language for smart contract development. It boasts a slew of features specific to the blockchain environment — and, notably, a lack of features that tend to produce costly mistakes — and it's such a small language that you can master it in a few months.

However, Pact has a steep initial learning curve because so many concepts are a departure from standard programming languages you've seen before. It's an immutable, non-Turing-complete [Lisp language](https://en.wikipedia.org/wiki/Lisp_(programming_language)) with language constructs specifically designed for smart contract programming powerful features like fine-grained access control, sophisticated multi-signature authorization, on-chain data storage, cross-chain state transfers, and formal code verification. That's a lot to learn — especially if you're new to blockchain development!

This article is a crash course in the Pact language. We'll go through as many Pact snippets as we can in 20 minutes of reading time; by the time we're through you won't be an expert, but you'll be able to understand most Pact code you see in the wild. I recommend that you follow along in a Pact REPL session and/or by writing Pact code in a file named `twenty-minutes.pact`. You can see [installation instructions on the Pact repo](https://github.com/kadena-io/pact#installing-pact).

This article was written with Pact 4.6. If you use Nix, you can drop into a Pact REPL session with the same executable I used in one line via [pact-nix](https://github.com/thomashoneyman/pact-nix):

```console
$ nix run github:thomashoneyman/pact-nix#pact-4_6_0
pact>
```

Alternately, you can get the executable in your shell:

```console
$ nix develop github:thomashoneyman/pact-nix#pact-4_6_0
$ pact --version
4.6.0
```

Without further ado: let's go!

---

Pact code is a list of expressions, where an expression is a literal, s-expression, atom, or reference. Pact code can contain comments; these begin with a semicolon and are ignored.

Pact has several basic literal types:

```clojure
"hello" ; a sequence of characters (string), created with quotes
'hello  ; a unique string literal (symbol), created with a single quote
42      ; an unbounded positive or negative integer
100.25  ; an unlimited precision positive or negative decimal
true    ; a true or false (boolean) value
```

It also supports lists and objects. Lists are ordered sequences of values enclosed in square brackets. Objects are key-value pairs enclosed in curly braces where keys are strings.

```clojure
[1 2]     ; a homogeneous list of integers
[1 true]  ; a heterogeneous list
[1, true] ; commas are optional in lists
{ "a": 1, "b": [1 2] } ; objects have string keys
{ 'a: 1, 'b: [1, 2] }  ; symbols are string literals so they're ok too
```

S-expressions are enclosed in parentheses and begin with either an atom, reference, or a special form. An atom is a non-reserved bare identifier (ie. a variable) such as the name of a function.

When an s-expression begins with an atom or reference then it is interpreted as function application. Function parameters are separated by spaces.

```clojure
; an s-expression that begins with an atom (the 'reverse' identifier) and is
; evaluated by applying the referenced reverse function to a list literal
(reverse [1 2]) ; [2 1]

; an s-expression that begins with a reference (atoms separated by periods)
; and is evaluated by applying the balance function from the coin module to
; a string literal
(coin.balance "k:abc123") ; 1.23223
```

When the s-expression begins with a special form then the special form is interpreted. Pact has many of these which we'll explore later.

Pact has a type system. You can inspect the type of an expression — here are a few common ones, though Pact has more that we'll see later on:

```clojure
(typeof "hello")    ; "string"
(typeof 'my-key)    ; "string"
(typeof 1234)       ; "integer"
(typeof 1.234)      ; "decimal"
(typeof true)       ; "bool"
(typeof { "a": 1 }) ; "object*"
(typeof [])         ; "[<a>]", ie. a list of values of type 'a'
(typeof reverse)    ; "defun", ie. a function
```

You can bind values to variables with `let`. The bound variables only exist within the scope of the let body. Pact does not allow mutation, so you can't reassign variables.

```clojure
(let
  ; The first set of parentheses is a list of binding pairs — that's right, a
  ; different list type from the syntax used to create list literals! Variables
  ; can be annotated with their types with ':'
  (
    (x:integer (+ 1 1))   ; bind the integer 2 to the name 'x'
    (y:[integer] [2 3 4]) ; bind the list of integers [2 3 4] to the name 'y'
  )
  ; After the binding pairs comes the let body, which must be an expression and
  ; which can refer to the binding pairs. Below we take the first 2 (the value
  ; of 'x') from the list 'y'.
  (take x y)
)
; [2 3]
```

A binding pair in a `let` cannot refer to other binding pairs. For that, use `let*` — but note that this incurs a higher gas cost because it is less performant, and you should prefer `let` when possible.

```clojure
(let*
  ; we can refer to 'x' in 'y' because we used let*, but this will produce a
  ; "cannot resolve x" error if you only use let — try it yourself!
  ( (x:integer 2) (y:integer (* x x)) )
  (+ y x)
)
; 6
```

You can destructure objects with the `bind` function and the `:=` binding operator:

```clojure
(bind
  ; First, we supply the object that we want to destructure
  { "a": 1, "b": 2, "c": 3, "d": 4 } 
  ; Then, we bind the value of the "a" key to the name 'a-value', and the
  ; value of the "d" key to the name 'd-value'.
  { "a" := a-value, "d" := d-value }
  ; Then comes the body of the bind expression, where we can refer to the atoms
  ; we bound, just as we've previously done with 'let' expressions.
  (+ a-value d-value)
)
; 5
```

Pact supports anonymous functions via the `lambda` keyword. A lambda takes a list of arguments and a body, which is an expression that can access those arguments (the same as a let or bind). 

> Remember to try these snippets in a Pact REPL!

```clojure
(let
  ; We bind the anonymous function denoted by the lambda to the name 'square'.
  ; This function takes one argument (x) and multiplies it by itself.
  ( (square (lambda (x) (* x x))) )
  (square 13)
)
; 169
```

Lambdas are especially useful in list-processing functions like `map`, `fold`, `filter`, and `zip`. These list processing functions are used pervasively because Pact is not Turing-complete; that means it does not support loops or recursion.

The `map` function applies a function of one argument to every value in a list.

```clojure
; Here we use map to square every integer in a list.
(map (lambda (x:integer) (* x x)) [1 2 3])
; 1 4 9
```

The `filter` function removes items from a list according to a predicate function (ie. a function that returns `true` or `false`).

```clojure
; Here we use filter to remove values less than 10.
(filter (lambda (x:integer) (>= x 10)) [1 10 100 1000])
; [10 100 1000]
```

The `zip` function merges two lists together with a combining function. The combining function takes two arguments, which represents the two list values at a given index, and returns a new value to place in the resulting list. If the list lengths differ then the resulting list is the length of the shortest list.

```clojure
; Here we use zip to turn two lists into a list of objects.
(zip (lambda (x:integer y:integer) { 'x: x, 'y: y }) [1 2] [3 4 5])
; [ { "x": 1, "y": 3 }, { "x": 2, "y": 4 } ]
```

The `fold` function reduces a list of values to a value with a reducer function and an initial accumulator value. The reducer function takes two arguments — the accumulated value so far and  the next value from the list — and returns a new accumulator value.

```clojure
; We can sum a list by adding all the values together.
(fold (lambda (acc:integer val:integer) (+ acc val)) 0 [2 3 4])
; 9

; Similarly, we can multiply all values in a list.
(fold (lambda (acc:integer val:integer) (* acc val)) 1 [2 3 4])
; 24

; Or we can convert a list of integers into a string by converting each integer
; into a string and concatenating them together.
(fold (lambda (acc:string val:integer) (+ acc (int-to-str 10 val))) "" [1 2 3])
; "123"

; Pact supports partial application, so we could rewrite our sum and fold
; functions to not use lambdas.
(fold (+) 0 [2 3 4]) ; 9
(fold (*) 1 [2 3 4]) ; 24
```

We now know how to create literal values, bind them to names (ie. create atoms), create anonymous functions, and use them to manipulate collections of values. There are many more utilities for working with literal values and collections in Pact which you can find in the [built-in functions section of the Pact documentation](https://pact-language.readthedocs.io/en/stable/pact-functions.html). We'll see many more of them in this article, but that's a handy reference!

Next, let's turn to conditional logic. Pact supports two forms of conditional logic: the `if` and `cond` functions. In Pact, functions are _total_, which means they always return a value. You can't handle only the `true` condition of an `if` statement, for example, unlike languages like JavaScript. Later' we'll see how to terminate a computation with an exception.

The first conditional logic function is the traditional if-else expression. It takes a condition, an expression to return if true, and an expression to return if false. 

```clojure
(if
  ; The first expression is a true/false condition
  (= 4 (+ 2 2))
  ; If the condition is true, then the first expression is returned
  "All is well"
  ; If not, then the second expression is returned
  "Something horrible has gone wrong"
)
; "All is well"
```

The second conditional logic function is `cond`, which is _technically_ a Pact special form rather than a normal function. It takes a series of if-else if-else expressions and turns them into nested if statements; it can't do anything that if-else can't do, but it's more convenient when you have many conditions.

```clojure
(let
  ((x:integer 5))
  ; cond takes a list of condition-return pairs (COND VALUE) and a default
  ; value where if the condition is true then the value is returned, and if 
  ; none of the pairs match then the final default case is returned.
  (cond
    ((= x 1) "X is 1")
    ((> x 1) "X is greater than 1")
    ((> x 10) "X is greater than 10")
    "X is less than 1"
  )
)
; "X is greater than 1"
```

Conditional logic is useful to insert branches in your code, but it shouldn't be used for errors. If an error has occurred in your code — like a function received an invalid value — then you should use the `enforce` function to throw an exception. In a blockchain environment this aborts the transaction.

```clojure
(enforce true "This message is shown on error")
; true

(enforce false "This message is shown on error")
; <interactive>:0:0: This message is shown on error
;   at <interactive>:0:0: (enforce false "This message is shown on error")
```

The `enforce` family of functions provide the only non-local exit allowed by Pact (the only exception to Pact's requirement that functions are _total_, ie. return a value for all inputs). There are other `enforce` functions, such as `enforce-keyset`, `enforce-guard`, and `enforce-one`.

You can format strings with the `format` interpolation function.

```clojure
(enforce (= 10 100) (format "The value {} is not equal to {}" [10, 100]))
; <interactive>:0:0: The value 10 is not equal to 100
```

So far we've focused on Pact code that can be written anywhere. However, a large portion of Pact code can only be written inside of a module — the main unit of code organization in Pact. Defining a module in the REPL mimics deploying it to the blockchain, so we should start to use explicit transactions. You can begin, end, and roll back transactions in the REPL:

```clojure
(begin-tx)
; "Begin Tx 0"
(commit-tx)
; "Commit Tx 0"
(rollback-tx) ; Undoes the transaction effects, but not the transaction counter
; "Rollback Tx"
```

It's a good practice to use `begin-tx` and `commit-tx` in the REPL roughly around the points where you expect to do the same on Chainweb.

A minimal Pact module has a unique name atom (no other modules on-chain can share the name), a governance function, and a body containing the API and data definitions.

```clojure
(begin-tx)
(module example GOVERNANCE
  (defcap GOVERNANCE () true)
  (defconst TEN 10))
; "Loaded module example, hash G1MU80sMEUZxC2E5NQINJ7Pfe03S8nd1I-gdVZ_WPrk"
(commit-tx)
```

`defconst` introduces a constant. We can access it by referring to its name within the module:

```clojure
(* 2 example.TEN)
; 20
```

`defcap` introduces a _capability_. A capability is a predicate function used for access control. The governance capability controls smart contract upgrades: you can only upgrade a module (ie. to fix a bug) if its governance function is satisfied. For example, this module cannot be upgraded:

```clojure
; This module cannot be upgraded because the capability cannot be satisfied
(module example GOVERNANCE
  (defcap GOVERNANCE () false))
```

You can also govern a module via a keyset reference. A keyset reference is a string identifying a particular keyset that has been defined on-chain; you can't define a module with a reference to a keyset that doesn't exist yet.

```clojure
(module example "my-keyset"
  (defconst TEN 10))
; <interactive>:0:0: No such keyset: 'my-keyset
```

So what _is_ a keyset? A keyset combines a list of public keys with a predicate function that determines how many of those keys must have signed a payload for the keyset to be satisfied. You can't write a keyset directly in Pact code, so here are a few keysets in their JSON form:

```jsonc
// all keys must sign to satisfy the keyset
{ "keys": ["pubkey1", "pubkey2"], "pred": "keys-all" }

// any key can be used to sign to satisfy the keyset
{ "keys": ["pubkey1", "pubkey2"], "pred": "keys-any" }

// if the predicate function is omitted it's the same as 'keys-all'
{ "keys": ["pubkey1", "pubkey2"] }

// the same is true if the keyset is just a list of keys
["pubkey1", "pubkey2"]

// you can also specify a predicate function from a module for more
// sophisticated situations
{ "keys": ["pubkey1", "pubkey2"], "pred": "example.my-keyset-predicate" 
```

A keyset reference is a string identifying a keyset that has been registered on Chainweb with `define-keyset`. We can't write a keyset directly in Pact, but we can write one in JSON, attach it to a transaction, and then read the data from the transaction in Pact. Let's do that in the REPL:

```clojure
; Pact code is always executed as part of a transaction. The env-data function
; sets a JSON payload on that transaction.
(env-data { "my-keyset": ["pubkey1"], "my-decimal": 1.12 })
; "Setting transaction data"

; We can then read from the transaction payload using the read-msg
(read-msg "my-keyset")  ; ["pubkey1"]
(read-msg "my-decimal") ; 1.12

; However, read-msg can only decipher simple Pact types. It's not suitable
; when you have a more complicated type like a keyset in mind.
(typeof (read-msg "my-keyset")) ; "[*]"

; Instead, you can use the read- function that matches the type you are
; trying to decode.
(typeof (read-keyset "my-keyset")) ; "keyset"

; Be careful! If you assert the wrong type, weird things can happen.
(read-integer "my-decimal") ; 1 
(read-integer "my-keyset")
; <interactive>:0:0: read-integer: parse failed: Failure parsing integer: Array [String "pubkey1"]: ["pubkey1"]
```

A brief aside: on Chainweb, all modules, interfaces, and keyset references must be deployed to a _namespace_. A namespace is a unique prefix; `free` and `user` can be used by anyone, while anyone can create a [principal namespace](https://medium.com/kadena-io/an-introductory-guide-to-kadena-namespaces-c6c34f95b902). Principal namespaces are generated, though, so if you want a vanity namespace like `my-app` it must be granted by the Kadena team.

The REPL doesn't include any namespaces because it isn't an actual blockchain. Some Pact code, though, requires that you are in a namespace, such as defining a keyset reference. We can define and enter a namespace with `define-namespace` and `namespace`:

```clojure
(define-namespace 'free (read-keyset 'my-keyset) (read-keyset 'my-keyset))
; "Namespace defined: free"

(namespace 'free)
; "Namespace set to free"

; We should go ahead and "re-deploy" our example module to the 'free namespace
; so we are faithfully mimicking Chainweb.
(module example GOVERNANCE
  (defcap GOVERNANCE () false))
; "Loaded module free.example, hash sT4jbDj2GhE_AGZG4A93FT5aAb-5Wfi_QTLS1WkCbJk"
```

One last thing: you can only register a keyset on-chain with `define-keyset` in a transaction that satisfies the keyset (ie. was signed by all required keys). You can simulate signing a transaction with the `env-sigs` function.

```clojure
; This transaction is signed with the private key associated with 'pubkey1' and
; the signature is not scoped to any capabilities
(env-sigs [ { "key": "pubkey1", "caps": [] } ])
; "Setting transaction signatures/caps"

; This transaction is also signed by pubkey1, but this time the signer has also
; signed for the GOVERNANCE capability.
(env-sigs [ { "key": "pubkey1", "caps": [ (free.example.GOVERNANCE) ] } ])
; "Setting transaction signatures/caps"
```

We can now put it all together and define a keyset:

```clojure
; These two lines would not be in the smart contract code, but rather would
; be on the transaction itself.
(env-data { "admin-keyset": [ "pubkey1" ] })
(env-sigs [ { "key": "pubkey1", "caps": [] } ])

; First we enter a namespace
(namespace "free")

; Then we define our keyset reference
(define-keyset "free.admin-keyset" (read-keyset "admin-keyset"))

; Then we use it to govern the module we are deploying, which means the module
; can only be upgraded (on Chainweb) in a transaction signed by this keyset.
(module example "free.admin-keyset"
  (defconst TEN 10))
; "Loaded module free.example, hash oxlUPEWJuToByJ47pe7RwyG8BDiSmfFuJ_QOoxrQ7hc"
```

You can use a keyset reference to govern a Pact module, or you can use a governance capability and the `enforce-keyset` function, which will throw an exception if the given keyset is not satisfied by the transaction signatures.

```clojure
; In practice this is the same as the previous module we defined, except that
; an upgrade would sign with the GOVERNANCE capability instead of just signing
; the transaction in general.
(module example GOVERNANCE
  (defcap GOVERNANCE () (enforce-keyset "free.admin-keyset")))
```

You can define more than constants and capabilities in a Pact module. You can also define functions, object types (schemas), database tables, formal verification properties, and more. 

Functions are defined with the `defun` special form. They have a name, a list of arguments, and a function body. You can add type annotations for the arguments and the return type.

```clojure
(module example "free.admin-keyset"
  (defun square:integer (x:integer)
    (* x x))
  (defun sum:integer (xs:[integer])
    (fold (+) 0 xs))
)
; "Loaded module free.example, hash rIBzCpDKTx0bC3FH84q98U7Emt0yzRJ7qoNHHJaAORc"

(free.example.square 3)    ; 9
(free.example.sum [1 2 3]) ; 6
```

Modules, functions, and many other Pact forms can have documentation strings:

```clojure
(module example "free.admin-keyset"
  @doc "An example module"
  
  (defun square (x:integer)
    @doc "A function to square integers"
    (* x x))
    
  (defun sum (xs:[integer])
    @doc "A function to sum a list"
    (fold (+) 0 xs))
)
```

You can write multiline strings with backslash escapes.

```clojure
(module example "free.admin-keyset"
  @doc "An example module that has a very long \
       \description of its contents."

  (defun add1 (x:integer) (+ 1 x))
)
```

Pact modules can also define object types (schemas) with the `defschema` special form.

```clojure
(module example "free.admin-keyset"
  ; A schema takes an atom that is used to refer to this type and then
  ; a list of fields, optionally associated with types.
  (defschema person
    @doc "Schema for a person object type"
    first:string
    last:string
    age:integer)

  ; We can then use this new type in our code.
  (defun get-age:integer (x:object{person})
    (at 'age x))

  (defun can-drink-america:bool (x:object{person})
    (>= (get-age x) 21))
)

(free.example.get-age { "first": "Eliud", "last": "Kipchoge", "age": 38 })
; 38

; Specifying the type gets us better error messages from the Pact interpreter
(free.example.get-age { "first": "Eliud", "age": 38 })
; <interactive>:10:26: Missing fields for {person}: [last:string]
```

Pact is a unique language in that it allows you to define and interact with database tables directly in your modules with the `deftable` special form. Pact has [many functions for dealing with databases](https://pact-language.readthedocs.io/en/stable/pact-functions.html#database-1), which we'll see below.

```clojure
(begin-tx)
(namespace 'free)
(module example GOV
  (defcap GOV () (enforce false "No governance."))

  (defschema runner
    country:string
    age:integer)

  ; We can use this schema to define a table for persistent on-chain storage.
  ; Tables always have string keys, and each row is an object with the
  ; specified schema type.
  (deftable runner-table:{runner}
    @doc "A table for runner ages")

  (defun add-runner (name:string entry:object{runner})
    ; We can insert rows into the table (will fail if the key already exists)
    (insert runner-table name entry))

  (defun get-runner:object{runner} (name:string)
    ; We can read a value from the table (will fail if the key is missing)
    (read runner-table name))

  (defun get-runner-age:integer (name:string)
    ; with-read is a combination of read and bind: it lets you read a row and
    ; bind its fields to variable names.
    (with-read runner-table name
      ; here we bind only the "age" field to the age name
      { "age" := age }
      ; and then we return it.
      age))

  (defun get-runner-age-default:integer (name:string)
    ; with-default-read is like with-read, but it returns the specified default
    ; value instead of throwing an exception on failure.
    (with-default-read runner-table name
      ; We provide a default value in the case the row cannot be found.
      { "age": 0, "country": "Uzbekistan" }
      { "age" := age }
      age))

  (defun under-30:[object{runner}] ()
    ; We can also select many rows using a filter function.
    (select runner-table (where 'age (> 30))))

  (defun names:[string] ()
    ; Or read all the keys used in the table
    (keys runner-table))
)
; "Loaded module free.example, hash 9uMpahkbL4dgdUHe1tZPVwQy2A4A-kWhsCSeQSeK7A0"
```

Defining a table is not quite enough — we also need to use the `create-table` top-level function outside our module to create the table. Without it you'll see an error:

```clojure
(free.example.names)
; <interactive>:21:4: : Failure: Database exception: query: no such table: USER_free.example_runner-table
;  at <interactive>:21:4: (keys (deftable runner-table:(defschema runner  [country...)
;  at <interactive>:0:0: (names)
```

But everything is OK if we remember to create the table.

```clojure
(create-table free.example.runner-table)
; "TableCreated"
```

We can now interact with our database.

```clojure
(free.example.add-runner "Eliud Kipchoge" { 'age: 38, 'country: "Kenya" })
; "Write succeeded"
(free.example.add-runner "Brigid Kosgei" { 'age: 29, 'country: "Kenya" })
; "Write succeeded"
(free.example.get-runner "Eliud Kipchoge")
; { "age": 38, "country": "Kenya" }
(free.example.get-runner "John Titus")
; <interactive>:15:4: read: row not found: John Titus
(free.example.under-30)
; [{ "age": 29, "country": "Kenya" }]
(free.example.names)
; ["Brigid Kosgei" "Eliud Kipchoge"]
(free.example.get-runner-age "John Titus")
; <interactive>:15:4: read: row not found: John Titus
(free.example.get-runner-age-default "John Titus")
; 0
```

In Pact, [data access is constrained to only functions defined in the same module](https://pact-language.readthedocs.io/en/stable/pact-reference.html#module-table-guards) or in a transaction where governance of the module has been granted. Since we're in the module deployment we can still freely access our tables outside the module:

```clojure
; This can only be run at the top-level because governance of the module has
; been granted.
(read free.example.runner-table "Brigid Kosgei")
; { "age": 38, "country": "Kenya" }
```

However, once we commit our current transaction we can no longer acquire governance (since the governance capability is always `false`), and can no longer access tables directly. Tables should be accessed through functions instead.

```clojure
(commit-tx)
(read free.example.runner-table "Brigid Kosgei")
; <interactive>:3:5: No governance
```

You'll find that most Pact modules consist of one or more databases, a selection of functions  that manipulate the database, and a set of capabilities that control access to sensitive functions.

We have only a few minutes left, so let's talk about guards and capabilities. A _guard_ is a predicate function over some environment that enables a pass-fail operation. The most typical guard is a keyset, like we've seen before. Assuming you've been following along in the REPL:

```clojure
; You can look at the contents of a keyset reference with describe-keyset
(typeof (describe-keyset "free.example-keyset"))
; "keyset"

; You can enforce a keyset guard with enforce-keyset. The below will fail,
; indicating that the transaction signatures do not satisfy the keyset.
(env-sigs [])
(enforce-keyset "free.example-keyset")
; <interactive>:0:0: Keyset failure (keys-all): 'free.example-keyset

; We can fix it by signing the transaction with the required keys.
(env-sigs [ { "key": "pubkey1", "caps": [] } ])
(enforce-keyset "free.example-keyset")
; true
```

Keysets are just one of several types of guard. Some functions expect to work with an arbitrary guard (not just keysets), so you can turn a keyset reference into a more general guard with `keyset-ref-guard`.

```clojure
(typeof (keyset-ref-guard "free.example-keyset"))
; "guard"
```

Arbitrary guards are enforced with `enforce-guard`.

```clojure
(enforce-guard (keyset-ref-guard "free.example-keyset"))
; true

; Pact will interpret strings as keyset references by default, so you don't
; actually have to use keyset-ref-guard with enforce-guard
(enforce-guard "free.example-keyset")
; true
```

The two most common guards are _capability guards_, which let you enforce that a particular capability has been acquired, and _user guards_, which lets you turn an arbitrary predicate function into a guard.

```clojure
(begin-tx)
(module guard-example "free.example-keyset"
  (defcap CAP_SUCCEED () (enforce true "succeed"))
  (defcap CAP_FAIL () (enforce false "fail"))
  (defun succeed () (enforce true "succeed"))
  (defun fail () (enforce false "fail"))
)

(create-capability-guard (free.guard-example.CAP_SUCCEED))
; CapabilityGuard {name: free.guard-example.CAP_SUCCEED,args: [],pactId: }
(typeof (create-capability-guard (free.guard-example.CAP_FAIL)))
; "guard"
(create-user-guard (free.guard-example.succeed))
; UserGuard {fun: free.guard-example.succeed,args: []}
(typeof (create-user-guard (free.guard-example.fail)))
; "guard"

; Each guard can be enforced with enforce-guard. Note that the user guard
; functions are simple predicates and can be called directly:
(enforce-guard (create-user-guard (free.guard-example.succeed)))
; true
(enforce-guard (create-user-guard (free.guard-example.fail)))
; <interactive>:5:17: fail

; But capabilities must be "acquired" — they aren't simple functions.
(enforce-guard (create-capability-guard (free.guard-example.CAP_SUCCEED)))
; <interactive>:0:0: Capability not acquired
(commit-tx)
```

You can _acquire_ a capability with `with-capability`. However, capabilities are like database tables, in that access can only be granted by code within the same module or when the transaction has governance priviliges. We'll see more about `with-capability` in a moment.

Guards are especially useful because they can be stored in tables. For example, you can store a list of user accounts along with a guard that must be satisfied to modify the account. That way the only way to modify the database record is by having the keyset or satisfying the account guard.

```clojure
(begin-tx)
(module guard-example GOV
  (defcap GOV () true)

  (defcap CAP_SUCCEED () (enforce true "succeed"))

  (defcap UPDATE_ADDRESS (name:string)
    (with-read account-table name
      { "guard" := guard }
      ; On this line we enforce that the guard associated with the account
      ; is satisfied before processing the update.
      (enforce-guard guard))

  (defschema account
    name:string
    address:string
    ; a 'guard' is a suitable type for storage in a database
    guard:guard)

  (deftable account-table:{account})

  (defun succeed () (enforce true "succeed"))

  (defun change-address (name:string new-address:string)
    (with-capability (UPDATE_ADDRESS name)
      (update account-table name { "address": new-address })))
)

(create-table free.guard-example.account-table)

; Recall that access to capabilities and tables is only allowed in module
; functions or when governance is granted for a module. Right now we're in
; the deployment transaction so we can freely access both.

(insert free.guard-example.account-table "Rick" 
  { "name": "Rick"
  , "address": "1111 Pine St"
  , "guard": (create-user-guard (free.guard-example.succeed))
  })
; "Write succeeded"

(insert free.guard-example.account-table "Morty" 
  { "name": "Morty"
  , "address": "1111 Pine St"
  , "guard": (create-capability-guard (free.guard-example.CAP_SUCCEED))
  })
; "Write succeeded"

; We can change Rick's address because it is protected by a guard that
; always evaluates to 'true'
(free.guard-example.change-address "Rick" "1234 Pine St")
; [true "Write succeeded"]

; We can't just change Morty's address because it is protected by a
; capability — one that is always true, but still must be acquired.
(free.guard-example.change-address "Morty" "1234 Pine St")
; <interactive>:15:8: Capability not acquired

; We can acquire a capability via with-capability, but not at the
; top-level. We'll do it inside a let instead.
(let ((_ 0)) 
  ; with-capability attempts to acquire a capability, failing if the
  ; predicate function fails (for example, if the capability required
  ; a signature on the transaction and there was none). in this case,
  ; the predicate for the capability always returns true, so we're ok.
  (with-capability (free.guard-example.CAP_SUCCEED)
    (free.guard-example.change-address "Morty" "1234 Pine St")))
; [true "Write succeeded"]

(commit-tx)
```

There are a few important functions for working with capabilities. We've seen `with-capability`, which acquires a capability for the scope of its body, allowing you to take sensitive actions. There is also `require-capability` which _enforces_ that a capability has been acquired with `with-capability`.

```clojure
; Require that CAPABILITY has already been acquired with with-capability for
; subsequent lines of code to run — essentially, enforce the capability.
(require-capability (CAPABILITY))

; It's like to writing this:
(enforce-guard (create-capability-guard (CAPABILITY)))
```

If you want all the nitty-gritty details on how the Pact capability system works, please see the [Capability Theory in Pact](https://github.com/kadena-io/pact/wiki/Capability-theory-in-Pact) wiki entry.

And with that our time is up! You should be able to get the gist of most of the Pact code you encounter in the wild, although you certainly won't be proficient from simply scanning these snippets.

Writing Pact is a different experience from reading it because you both must understand Pact and solve your problem at the same time, translating the solution into usable Pact code.

For more Pact material you may want to check out:

* The [Pact language documentation](https://pact-language.readthedocs.io/en/stable/)
* The [Real World Pact](https://github.com/thomashoneyman/real-world-pact) project series

Have fun writing some Pact!
