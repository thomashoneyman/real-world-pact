(namespace "free")

(interface charkha-market-iface

  ; ----------
  ; SCHEMA

  (defschema participant
    @doc
      "Schema for the state maintained about a market participant, updated when\
      \that participant interacts with the market. This also serves as the      \
      \accounts table for the fungible-v2 interface."

    ; Block height of the last update, ie. last interest rate change
    last-updated:integer
    ; The interest rate index at the time of the last update, which is used to
    ; calculate total interest owed at the time of the next update
    last-rate-index:decimal
    ; The user's total collateral in this market (in tokens, not the asset).
    balance:decimal
    ; The user's total borrows in this market.
    borrows:decimal
    ; The user's guard for the account.
    guard:guard)

  ; ---------
  ; FUNCTIONS

  ; We do not accrue interest for borrowers over time and instead just keep
  ; track of the interest rate index. However, sometimes we do need to apply
  ; the index to a borrower's balance (ie. accrue interest), such as when
  ; checking whether they have exceeded their borrowing capacity and can be
  ; liquidated or when they move to repay their interest.
  (defun accrue-interest:decimal (account:string)
    @doc
      "Accrue interest owed to a borrower according to the interest rate index,\
      \returning their new borrow total.")

  ; A user should be able to supply or borrow funds on Charkha with zero
  ; participation from the protocol itself. To facilitate crediting cTokens to
  ; a user account without the Charkha signature, we use a two-step pattern in
  ; which the protocol records the funds a user has supplied or borrowed and
  ; then immediately calls the (apply-balance-change) function in the associated
  ; market contract to credit or debit those funds.
  ;
  ; This function is unguarded (anyone can call it), but its implementation
  ; should always ask the controller contract for the correct amount.
  (defun apply-balance-change:string (account:string guard:guard)
    @doc
      "Add tokens to an account that has supplied funds or remove them from an \
      \account that has borrowed funds.")

  (defun get-participant:object{participant} (account:string)
    @doc "Read data about a market participant.")

  (defun get-borrow:decimal (account:string)
    @doc
      "Get the total borrow amount for a market participant denominated in the\
      \underlying asset. May be out of date; if you need the up-to-date borrow \
      \with interest applied, use (accrue-interest).")

  (defun get-supply:decimal (account:string)
    @doc
      "Get the total supply amount for a market participant denominated in the \
      \underlying asset. To see the cToken balance, use (get-balance).")

)
