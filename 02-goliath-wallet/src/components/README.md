# Components

This directory contains a few React components we're using to build the wallet UI. There is one component for each major section:

- `AccountOverview.tsx` displays the overall account balance and per-chain balances.
- `AdminModal.tsx` displays the admin modal for changing per-request and per-account limits via the faucet smart contract.
- `RequestFundsModal.tsx` displays the modal for requesting funds from the faucet smart contract.
- `ReturnFundsModal.tsx` displays the modal for returning funds to the faucet smart contract.
- `Transactions.tsx` displays the list of transactions section, including the "transaction details" modal.

All of these components are standard React, and so they're lightly commented. Feel free to read them to see how we render based on Pact request statuses and sometimes make new requests of our own, but for the most part these are application-specific.
