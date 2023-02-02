; The Charkha governance contract allows Charkha market participants to propose,
; and vote on changes to some elements of the lending protocol. We've kept the
; implementation small so that it's understandable, but you can scale this up
; such that market participants can control significantly more of the protocol.
;
; Voting works like this:
;
;  1. A CHRK holder opens a proposal
;  2. Other CHRK holders can vote for or against the proposal. Their account
;     name is registered as the vote.
;  3. When the vote closes, the protocol tallies all CHRK held by voters on both
;     sides of the proposal. Whichever side has more CHRK is the winner.
;  4. If the vote succeeded, then the proposed change to the market factors
;     goes into effect.
(namespace "free")

(enforce-guard (keyset-ref-guard "free.charkha-admin-keyset"))

(module charkha-governance GOVERNANCE
  @doc
    "The Charkha governance contract which controls rates for the various      \
    \markets supported by the protocol and coordinates community proposals and \
    \votes to change the protocol."

  ; ----------
  ; SCHEMA

  ; For the sake of testing we'll use a short voting time so it's possible to
  ; see rapid updates in the UI.
  (defconst VOTING_PERIOD (minutes 2))

  (defschema market-factors
    @doc
      "Schema for the factors about a market that can be controlled by         \
      \community governance proposals, such as reserve factors or base rates.  \
      \Keyed by market symbols e.g. KDA for the cwKDA market."

    ; Please see the Charkha white paper for the full details. Percentages are
    ; recorded as decimals from 0 to 1.

    ; The minimum interest rate for borrowers.
    base-rate:decimal
    ; The relative increase in interest rates with respect to utilization.
    multiplier:decimal
    ; The percentage of borrow interest held back by the protocol as reserves.
    reserve-factor:decimal
    ; What portion of a user's market holdings can be used as collateral.
    collateral-ratio:decimal)

  (deftable factors-table:{market-factors})

  ; The possible statuses of a governance proposal.
  (defconst STATUS_OPEN "OPEN")
  (defconst STATUS_REJECTED "REJECTED")
  (defconst STATUS_ACCEPTED "ACCEPTED")

  (defschema proposal
    @doc
      "Schema for community proposals to modify factors about a market. Keyed  \
      \by the proposal identifier in the form 'CP-X' where X is the proposal   \
      \number, ie. CP-1 or CP-297."

    @model
      [ (invariant (!= "" name))
        ; We restrict the 'status' column to be only one of three states.
        (invariant (or (= STATUS_OPEN status) (or (= STATUS_REJECTED status) (= STATUS_ACCEPTED status))))
      ]

    author:string
    market:string
    name:string
    created:time
    status:string
    ; Which market factor should be updated, for example "base-rate"
    proposal-factor:string
    ; What the new value should be, for example 0.1
    proposal-value:decimal
    ; Accounts that are voting for the proposal.
    for:[string]
    ; Accounts that are voting against the proposal.
    against:[string])

  (deftable proposals-table:{proposal})

  ; We cache the latest proposal number and ID in a table so we can cheaply and
  ; efficiently read it back. We could also use the (keys) function and count
  ; the number of keys, but unfortunately the (keys) function requires about
  ; 40_000 units of gas.
  (defschema proposal-count id:integer)
  (defconst PROPOSAL_COUNT_KEY "latest")
  (deftable proposal-count-table:{proposal-count})

  ; ----------
  ; CAPABILITIES

  (defcap GOVERNANCE ()
    (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset")))

  (defcap ADMIN:bool ()
    @doc "A capability for admin-only actions."
    (enforce-guard (keyset-ref-guard "free.charkha-admin-keyset")))

  (defcap INTERNAL () true)

  (defcap VOTE:bool (account:string)
    @doc "A capability restricting voters to CHRK holders who have not voted."

    (enforce (!= account "") "Account cannot be empty.")
    (let ( (user (free.CHRK.details account)) )
      ; The user must sign the VOTE capability with the guard associated with
      ; their CHRK account.
      (enforce-guard (at 'guard user))
      (enforce (> (at 'balance user) 0.0) "Must have a CHRK balance to vote.")))

  ; ----------
  ; FUNCTIONS

  (defun init-market:string (market:string initial-factors:object{market-factors})
    @doc "Initialize a new market with the given factors. Admin-only."
    (with-capability (ADMIN)
      (let
        ( (base-rate (at 'base-rate initial-factors))
          (reserve-factor (at 'reserve-factor initial-factors))
          (multiplier (at 'multiplier initial-factors))
          (collateral-ratio (at 'collateral-ratio initial-factors))
        )
        (enforce (and (>= base-rate 0.005) (<= base-rate 0.2)) "Base rate must be between 0.01 and 0.2")
        (enforce (and (>= reserve-factor 0.0) (<= reserve-factor 0.2)) "Reserve factor must be between 0.0 and 0.2")
        (enforce (and (>= multiplier 0.0) (<= multiplier 1.0)) "Multiplier must be between 0 and 1")
        (enforce (and (>= collateral-ratio 0.0) (<= collateral-ratio 1.0)) "Collateral ratio must be between 0 and 1")
        (insert factors-table market initial-factors)
      )
      "Initialized"))

  (defun get-market-factors:object{market-factors} (market:string)
    @doc "Read the current market factors for the given asset."
    (read factors-table market))

  (defun submit-proposal:string (account:string name:string market:string factor:string new-value:decimal)
    @doc "Submit a new proposal for the given market. Returns proposal ID."

    (enforce (>= (length name) 3) "Proposal name must be at least 3 characters.")
    (enforce (contains factor ["base-rate", "multiplier", "reserve-factor", "collateral-ratio"]) "Unrecognized factor.")

    ; Next we can verify that the rates are all within their acceptable limits.
    (if (= "base-rate" factor)
      (enforce (and (>= new-value 0.005) (<= new-value 0.2)) "Base rate must be between 0.005 and 0.2")
      (if (= "multiplier" factor)
        (enforce (and (>= new-value 0.0) (<= new-value 1.0)) "Multiplier must be between 0 and 1")
        (if (= "reserve-factor" factor)
          (enforce (and (>= new-value 0.0) (<= new-value 0.2)) "Reserve factor must be between 0.0 and 0.2")
          (enforce (and (>= new-value 0.0) (<= new-value 1.0)) "Collateral ratio must be between 0.0 and 1.0"))))

    (with-capability (VOTE account)
      (let*
        (
          (next-count:integer (with-default-read proposal-count-table PROPOSAL_COUNT_KEY { "id": 1 } { "id" := id } id))
          (next-id:string (+ "CP-" (int-to-str 10 next-count)))
        )
        (insert proposals-table next-id
          { "author": account
          , "market": market
          , "name": name
          , "created": (at 'block-time (chain-data))
          , "status": STATUS_OPEN
          , "proposal-factor": factor
          , "proposal-value": new-value
          , "for": [account]
          , "against": []
          })
        (write proposal-count-table PROPOSAL_COUNT_KEY { "id": (+ 1 next-count) })
        next-id)))

  ; A user can vote if:
  ;   1. They have a CHRK balance at the given account (checked by VOTE).
  ;   2. The proposal is open for voting.
  ;   3. They have not voted for the proposal before.
  (defun vote:string (account:string proposal-id:string choice:bool)
    @doc
      "Vote for the given proposal where true indicates a supporting vote and  \
      \false indicates a rejecting vote. Cannot vote more than once."

    (with-capability (VOTE account)
      (with-read proposals-table proposal-id { "status" := status, "for" := for, "against" := against }
        (enforce (= status STATUS_OPEN) "Voting is closed.")
        (enforce (not (or (contains account for) (contains account against))) "Cannot vote more than once.")
        (if choice
          (update proposals-table proposal-id { "for": (+ [account] for) })
          (update proposals-table proposal-id { "against": (+ [account] against) })))))

  (defun get-proposal:object{proposal} (proposal-id:string)
    @doc "Get the proposal at the given ID, such as CP-1."
    (read proposals-table proposal-id))

  ; Anyone can close a proposal, so long as the voting period has completed.
  ; When the proposal is closed the votes will be tallied and the update will
  ; go inte effect, if it passed.
  (defun close-proposal:string (proposal-id:string)
    @doc
      "Close voting on the proposal at the given ID. Will only work if the     \
      \required voting window has closed. Implements the proposal if there is a\
      \majority in favor, and otherwise makes no change."

    (with-read proposals-table proposal-id
      { "created" := created
      , "status" := status
      , "for" := for
      , "against" := against
      , "market" := market
      , "proposal-factor" := factor
      , "proposal-value" := new-value
      }

      ; We can only close the vote if the full voting period has elapsed.
      (enforce (< VOTING_PERIOD (diff-time (at 'block-time (chain-data)) created)) "Voting period has not completed.")
      (enforce (= STATUS_OPEN status) "This vote has already closed.")

      (let
        (
          (for-count:decimal (fold (+) 0.0 (map (free.CHRK.get-balance) for)))
          (against-count:decimal (fold (+) 0.0 (map (free.CHRK.get-balance) against)))
        )
        (if (> for-count against-count)
          ; If the vote passed, then we update the proposal status and implement
          ; the change. We use a dummy (let) value below because Pact does not
          ; allow heterogeneous lists in the body of an (if), unfortunately.
          (let ((_ 0))
            (update proposals-table proposal-id { "status": STATUS_ACCEPTED })
            (if (= "base-rate" factor)
              (update factors-table market { "base-rate": new-value })
              (if (= "multiplier" factor)
                (update factors-table market { "multiplier": new-value })
                (if (= "reserve-factor" factor)
                  (update factors-table market { "reserve-factor": new-value })
                  (update factors-table market { "collateral-ratio": new-value }))))
            "Proposal passed.")

          ; Otherwise, we simply update the proposal status.
          (let ((_ 0))
            (update proposals-table proposal-id { "status": STATUS_REJECTED })
            "Proposal failed.")))))
)

(if (read-msg "init")
  [ (create-table free.charkha-governance.factors-table)
    (create-table free.charkha-governance.proposals-table)
    (create-table free.charkha-governance.proposal-count-table)
  ]
  "Upgrade complete")
