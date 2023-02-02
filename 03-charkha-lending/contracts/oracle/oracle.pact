; Our primitive oracle contract records USD price data from the CoinMarketCap
; API every few minutes. You can think of this contract as a public price
; database that anyone on the blockchain can read from, but which only a trusted
; administrator (Charkha) can write to.
(namespace "free")

(enforce-guard (keyset-ref-guard "free.charkha-admin-keyset"))

(module charkha-oracle GOVERNANCE
  @doc "'charkha-oracle' represents the Charkha Oracle. This contract provides \
  \access to USD prices for a set of supported tokens. Prices are updated every\
  \few minutes by the Charkha admin account according to CoinMarketCap. It is  \
  \suitable for test environments only."

  ; We record the current price in USD for each asset Charkha supports. We can
  ; add more assets later if we see fit. While it isn't necessary, I've also
  ; decided to record the last updated time for each asset so it's possible to
  ; see if price data is stale.
  ;
  ; We will key the table by normal asset symbols like KDA instead of the ids
  ; CoinMarketCap uses so that it's easier to understand. But in the real world
  ; this would be insufficient.
  (defschema asset
    @doc "The Charkha oracle contract assets schema. Keyed by asset symbol, e.g. KDA."
    @model [ (invariant (>= usd-price 0.0)) ]
    usd-price:decimal
    last-updated:time)

  (deftable asset-table:{asset})

  (defcap GOVERNANCE ()
    (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset")))

  ; We're going to lean on this capability to prevent anyone except the Charkha
  ; admins from modifying the asset table.
  (defcap ADMIN ()
    @doc "A guard for admin-only actions, restricted to the free.charkha-admin-keyset keyset."
    (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset")))

  (defun register-asset:string (symbol:string usd-price:decimal)
    @doc "Register a new asset in the oracle database (admin-only)."
    @model
      [ (property (authorized-by "free.charkha-admin-keyset"))
        ; It should not be possible to overwrite an asset. To verify this, we
        ; verify that we never insert an asset that already existed.
        ; https://pact-language.readthedocs.io/en/stable/pact-properties-api.html#row-exists
        (property (= false (row-exists asset-table symbol "before")))
        ; USD prices must always be non-negative.
        (property (>= usd-price 0.0))
      ]

    (enforce (>= usd-price 0.0) "Cannot register an asset with a negative USD price.")

    (with-capability (ADMIN)
      ; We can get the current time by reading the chain data:
      ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#chain-data
      ;
      ; and retrieving the "block-time" field from the resulting object using "at":
      ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#at
      ;
      ; This will produce a value of type "time" in the standard time format:
      ; https://pact-language.readthedocs.io/en/stable/pact-reference.html#time-formats
      (let ((current-time:time (at 'block-time (chain-data))))
        ; This line is a little tricky. We do not want to let you overwrite an
        ; existing entry in the database, which can happen with (write):
        ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#write
        ;
        ; Instead, we'll use (insert), which will fail if the key already exists.
        ; https://pact-language.readthedocs.io/en/stable/pact-functions.html#insert
        (insert asset-table symbol
          { "usd-price": usd-price
          , "last-updated": current-time
          }))))

  ; This is the primary function in the module: the ability to set the price for
  ; a registered asset. This is separated from register-asset in case we want to
  ; make registering an asset something CHRK token holders can vote on; we will
  ; only ever let the Charkha admin set prices.
  (defun set-price:string (symbol:string usd-price:decimal)
    @doc "Set the USD price of the given asset (admin-only)."
    @model
      [ (property (authorized-by "free.charkha-admin-keyset"))
        (property (>= usd-price 0.0))
      ]

    (enforce (>= usd-price 0.0) "Cannot set an asset to a negative USD price.")
    (with-capability (ADMIN)
      (let ((current-time:time (at 'block-time (chain-data))))
        (update asset-table symbol { "usd-price": usd-price, "last-updated": current-time }))))

  ; The functions from this point onwards are open to anyone and allow read-only
  ; access to the assets table.
  (defun get-assets:[string] ()
    @doc "List all assets with prices recorded by the oracle, e.g. [ 'KDA', 'CHRK', ... ]."
    (keys asset-table))

  (defun get-asset:object{asset} (symbol:string)
    @doc "Read the USD price and last updated time of the given asset."
    (read asset-table symbol))

  (defun get-price:decimal (symbol:string)
    @doc "Read the USD price of the given asset."
    (with-read asset-table symbol { "usd-price" := usd-price } usd-price))
)

(if (read-msg "init")
  (create-table free.charkha-oracle.asset-table)
  "Upgrade complete")
