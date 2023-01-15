(namespace "free")

(module charkha-oracle GOVERNANCE

  @doc "'charkha-oracle' represents the Charkha Oracle. This contract provides \
  \access to USD prices for a set of supported tokens. Prices are updated every\
  \few minutes by the Charkha admin account according to Coin Market Cap. It   \
  \is suitable for test environments only."

  @model
    [ (defproperty charkha-authorized (authorized-by "free.charkha-admin-keyset"))
    ]

  (defschema asset
    @doc "The Charkha oracle contract assets schema. Keyed by asset symbol, e.g. KDA."
    @model [ (invariant (>= usd-price 0.0)) ]

    usd-price:decimal
    last-updated:time)

  (deftable asset-table:{asset})

  (defcap GOVERNANCE ()
    (enforce false "Enforce non-upgradeability"))

  ; TODO: Only the admin should be able to do this. Should not be possible to
  ; overwrite an asset. Note that this assumes that symbols are unique, which
  ; is only true in our test world; in the real world you'd need unique IDs.
  (defun register-asset:string (symbol:string usd-price:decimal)
    (let ((current-time:time (at 'block-time (chain-data))))
      (write asset-table symbol
        { "usd-price": usd-price
        , "last-updated": current-time
        })))

  (defun list-assets ()
    (keys asset-table))

  (defun get-asset:object{asset} (symbol:string)
    (read asset-table symbol))

  (defun get-price:decimal (symbol:string)
    (with-read asset-table symbol { "usd-price" := usd-price } usd-price))

  ; TODO: Only the admin should be able to do this.
  (defun set-price:object{asset} (symbol:string usd-price:decimal)
    (update asset-table symbol { "usd-price": usd-price }))
)

(create-table free.charkha-oracle.asset-table)
