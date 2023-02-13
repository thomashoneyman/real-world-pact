/* APP

This component is the main entrypoint for our app. Since the application is
small, the important app state (ie. various requests to the Chainweb node such
as funds requests) will be stored in this component. You can use it as a good
example of how to use the pact-utils helper library to make requests to Chainweb.

*/

import React, { useEffect } from "react";

import * as Pact from "pact-lang-api";

import { Box, Container, Flex } from "@real-world-pact/theme/components/Container";
import { GlobalStyles } from "@real-world-pact/theme/components/GlobalStyles";
import { GoliathLogo, Navbar } from "@real-world-pact/theme/components/Navbar";

import * as coin from "./contracts/coin-v5";
import * as faucet from "./contracts/goliath-faucet";

import { userAccount, userKeySet } from "./accounts";

import { AdminModal } from "./components/AdminModal";
import { RequestFundsModal } from "./components/RequestFundsModal";
import { ReturnFundsModal } from "./components/ReturnFundsModal";
import { AccountOverview } from "./components/AccountOverview";
import { Transactions, useTransactions } from "./components/Transactions";
import { usePactRequest, usePactRequestAllChains } from "./pact-api";
import { SUCCESS } from "@real-world-pact/utils/pact-request";

const App = () => {
  // First we will track the request and account limits associated with our user
  // account, as far as the faucet is concerned.
  const [limits, runGetLimits] = usePactRequest(faucet.getLimits);

  // Next, we'll use the (coin.details) function to look up our account's
  // balances. While we only need to look up account limits on Chain 0 (where
  // the faucet is deployed), we want to look up account balances on all chains.
  const [details, runDetails] = usePactRequestAllChains(coin.details);

  // Finally, we'll record any funds transfers we make in the UI using the
  // <Transactions /> component, which gives us a hook for collecting requests
  // together into one list.
  const [transactions, newTransaction] = useTransactions();

  // After a successful transfer we'll want to refresh the user's balances and
  // remaining account limits.
  const refreshUserData = async () => {
    await runDetails({ address: userAccount.address });
    await runGetLimits({ address: userAccount.address });
  };

  // We will always request funds and return funds on behalf of the user account
  // so we can specialize our two functions to make them easier to use. We'll
  // also refresh the user data after a successful transfer.
  const userRequestFunds = async (amount: Pact.PactDecimal) => {
    const input = { targetAddress: userAccount.address, targetAddressKeySet: userKeySet, amount };
    const result = await newTransaction(
      faucet.requestFunds(input),
      amount,
      faucet.FAUCET_ACCOUNT,
      input.targetAddress
    );
    if (result.status === SUCCESS) {
      await refreshUserData();
    }
  };

  const userReturnFunds = async (amount: Pact.PactDecimal) => {
    const input = { account: userAccount.address, accountKeys: userAccount.keys, amount };
    const result = await newTransaction(
      faucet.returnFunds(input),
      amount,
      input.account,
      faucet.FAUCET_ACCOUNT
    );
    if (result.status === SUCCESS) {
      await refreshUserData();
    }
  };

  // All right! Our requests are all set up and tidy; we can now easy make
  // various calls to Chainweb and use their results in our UI. Let's kick
  // things off by requesting some KDA from the faucet on the user's behalf.
  useEffect(() => {
    (async () => {
      // First we'll load the user's balances so that they can immediately see
      // how much KDA they have.
      await runDetails({ address: userAccount.address });
      // Then we'll request 15 KDA from the faucet. On app load the user will
      // see this transaction in the UI along with its status.
      await userRequestFunds({ decimal: "20.0" });
    })();
  }, []);

  // Our wallet UI is made up of three primary sections: the navbar, the account
  // overview, and the transactions.
  return (
    <GlobalStyles>
      <Box css={{ padding: "0 $1" }}>
        <Navbar logo={<GoliathLogo />}>
          <Flex css={{ alignItems: "center" }}>
            <AdminModal
              css={{ marginRight: "$3" }}
              onSuccess={async () => {
                await runGetLimits({ address: userAccount.address });
              }}
            />
            <RequestFundsModal
              css={{ marginRight: "$2" }}
              onSubmit={async (amount: Pact.PactDecimal) => {
                await userRequestFunds(amount);
              }}
            />
            <ReturnFundsModal
              onSubmit={async (amount: Pact.PactDecimal) => {
                await userReturnFunds(amount);
              }}
            />
          </Flex>
        </Navbar>
        <Container size="md">
          <AccountOverview balances={details} />
          <Transactions limits={limits} transactions={transactions} />
        </Container>
      </Box>
    </GlobalStyles>
  );
};

export default App;
