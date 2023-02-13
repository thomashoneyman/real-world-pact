/* The loader manages deploying all of our contracts, initializing the markets,
and making initial lends and borrows with some of the sender accounts built in
to the Chainweb nodes.

This is a huge module because it's serving to deploy all contracts, register
them with initial values, and start long-running update tasks like querying the
blockchain for price and user data. It's essentially a deployment dashboard,
with guards in place to make sure we skip through the loader if all resources
have already been initialized.

You can read this if you would like to see what putting together a deployment
dashboard might look like, but otherwise you can safely skip it.
*/

import {
  coercePactValue,
  EXEC_ERROR,
  LocalRequest,
  PENDING,
  RequestStatus,
  REQUEST_ERROR,
  SendRequest,
  SUCCESS,
} from "@real-world-pact/utils/pact-request";

import {
  charkhaKeyPair,
  charkhaKeyset,
  sender01Address,
  sender01KeyPair,
  sender01Keyset,
  sender02Address,
  sender02KeyPair,
  sender02Keyset,
} from "../constants";
import { pactAPI, usePactRequest } from "../pact-api";
import { ReactElement, useEffect, useState } from "react";
import { Header, Text } from "@real-world-pact/theme/components/Text";
import { Spinner } from "@real-world-pact/theme/components/Spinner";
import { Box, Container, Flex } from "@real-world-pact/theme/components/Container";
import { ErrorIcon, NotStartedIcon, SuccessIcon } from "@real-world-pact/theme/components/Icon";

import * as oracle from "../contracts/oracle";
import * as KETH from "../contracts/keth";
import * as CHRK from "../contracts/chrk";
import * as cwKDA from "../contracts/cwKDA";
import * as cwKETH from "../contracts/cwKETH";
import * as cwCHRK from "../contracts/cwCHRK";
import * as controller from "../contracts/controller";

import marketInterfaceContract from "../../../contracts/interfaces/market-interface.pact?raw";
import controllerInterfaceContract from "../../../contracts/interfaces/controller-interface.pact?raw";
import oracleContract from "../../../contracts/oracle/oracle.pact?raw";
import kethContract from "../../../contracts/tokens/keth.pact?raw";
import chrkContract from "../../../contracts/tokens/chrk.pact?raw";
import cwKDAContract from "../../../contracts/markets/cwKDA.pact?raw";
import cwKETHContract from "../../../contracts/markets/cwKETH.pact?raw";
import cwCHRKContract from "../../../contracts/markets/cwCHRK.pact?raw";
import governanceContract from "../../../contracts/governance.pact?raw";
import controllerContract from "../../../contracts/controller.pact?raw";

import {
  syncState,
  useAppStore,
  useCoinMarketCapStore,
  useMarketStore,
  useOracleStore,
  useUserStore,
} from "../state";
import { AssetName } from "../contracts/controller";

/* REQUESTS

Each of the functions below is a Pact request suitable to be sent with either
the pactAPI class or a usePactRequest hook.

*/

const describeCharkhaKeyset = (): LocalRequest<string> => ({
  code: { cmd: "describe-keyset", args: ["free.charkha-admin-keyset"] },
  transformResponse: (response) => coercePactValue(response),
});

const defineCharkhaKeyset = (): SendRequest<string> => ({
  code: [
    { cmd: "namespace", args: ["free"] },
    {
      cmd: "define-keyset",
      args: ["free.charkha-admin-keyset", { cmd: "read-keyset", args: ["charkha-admin-keyset"] }],
    },
  ],
  data: { "charkha-admin-keyset": charkhaKeyset },
  // We use sender02 as the payer because the Charkha account doesn't exist yet.
  sender: sender02Address,
  gasLimit: 500,
  signers: [{ ...sender02KeyPair, clist: [{ name: "coin.GAS", args: [] }] }, { ...charkhaKeyPair }],
  transformResponse: (response) => response as string,
});

const describeContract = (name: string): LocalRequest<string> => ({
  code: { cmd: "describe-module", args: [name] },
  transformResponse: (response) => response as string,
});

const deployContract = (contract: string): SendRequest<string> => ({
  code: contract,
  data: { init: true },
  sender: sender02Address,
  gasLimit: 100_000,
  signers: [{ ...sender02KeyPair, clist: [{ name: "coin.GAS", args: [] }] }, { ...charkhaKeyPair }],
  transformResponse: (response) => response as string,
});

/* FUNCTIONS

These functions capture individual deployment steps to run.

*/

// This helper function merges a pair of requests together. It's intended for
// a pre-flight check that determines whether it is necessary to make the second
// request and isn't suitable to merge other arbitrary requests together.
function mergeRequests<res>(
  a: null | RequestStatus<res>,
  b: null | RequestStatus<res>
): null | RequestStatus<res> {
  if (a && b) {
    if (a.status === PENDING) return a;
    if (b.status === PENDING) return b;
    if (a.status === REQUEST_ERROR) return a;
    return b;
  } else if (a) {
    return a;
  } else if (b) {
    return b;
  } else {
    return null;
  }
}

const useDeployCharkhaKeyset = (): null | RequestStatus<string> => {
  const [describeStatus, runDescribe] = usePactRequest(describeCharkhaKeyset);
  const [registerStatus, runRegister] = usePactRequest(defineCharkhaKeyset);

  useEffect(() => {
    runDescribe({}).then((describe) => {
      if (describe.status === "EXEC_ERROR") {
        runRegister({});
      }
    });
  }, []);

  return mergeRequests(describeStatus, registerStatus);
};

const useDeployContract = (
  module: string,
  contract: string,
  depends?: (RequestStatus<any> | null)[]
): null | RequestStatus<string> => {
  const [describeStatus, runDescribe] = usePactRequest(describeContract);
  const [deployStatus, runDeploy] = usePactRequest(deployContract);
  const ready =
    !depends ||
    (depends && depends.reduce((acc, req) => (req ? acc && req.status === SUCCESS : false), true));

  useEffect(
    () => {
      if (ready) {
        runDescribe(module).then((describe) => {
          if (
            describe.status === "EXEC_ERROR" &&
            describe.response.result.error.message === `Module not found: ${module}`
          ) {
            runDeploy(contract);
          } else if (describe.status === "EXEC_ERROR") {
            throw `Unexpected error deploying ${module}: ${describe}`;
          }
        });
      }
    },
    depends ? depends : []
  );

  return mergeRequests(describeStatus, deployStatus);
};

const useRegisterOracleAsset = (
  symbol: AssetName,
  depends: (RequestStatus<any> | null)[]
): null | RequestStatus<unknown> => {
  const ready = depends.reduce((acc, req) => (req ? acc && req.status === SUCCESS : false), true);
  const [getAsset, runGetAsset] = usePactRequest(oracle.getAsset);
  const [registerAsset, runRegisterAsset] = usePactRequest(oracle.registerAsset);

  useEffect(() => {
    if (ready) {
      const init = async () => {
        const { lastPrices } = useCoinMarketCapStore.getState();
        await runGetAsset(symbol).then((result) => {
          if (result.status === EXEC_ERROR) {
            runRegisterAsset({ symbol, price: { decimal: lastPrices[symbol].toFixed(13) } });
          }
        });
      };
      init();
    }
  }, depends);

  return mergeRequests(
    getAsset as null | RequestStatus<unknown>,
    registerAsset as null | RequestStatus<unknown>
  );
};

const useInitModuleReference = (
  isInitialized: LocalRequest<boolean>,
  initialize: SendRequest<string>,
  depends: (RequestStatus<any> | null)[]
): null | RequestStatus<unknown> => {
  const [isInitializedStatus, runIsInitialized] = usePactRequest(() => isInitialized);
  const [initializeStatus, runInitialize] = usePactRequest(() => initialize);
  const ready = depends.reduce((acc, req) => (req ? acc && req.status === SUCCESS : false), true);

  useEffect(() => {
    const run = async () => {
      const response = await runIsInitialized({});
      if (response.status === SUCCESS && response.parsed === false) {
        await runInitialize({});
      }
    };
    if (ready) run();
  }, depends);

  return mergeRequests(
    isInitializedStatus as null | RequestStatus<unknown>,
    initializeStatus as null | RequestStatus<unknown>
  );
};

const useRegisterMarket = (
  symbol: AssetName,
  depends: (RequestStatus<any> | null)[]
): null | RequestStatus<unknown> => {
  const ready = depends.reduce((acc, req) => (req ? acc && req.status === SUCCESS : false), true);

  const [getMarket, runGetMarket] = usePactRequest(controller.getMarket);
  const [registerMarket, runRegisterMarket] = usePactRequest(controller.registerMarket);

  useEffect(() => {
    if (ready) {
      const init = async () => {
        await runGetMarket(symbol).then((result) => {
          if (result.status === EXEC_ERROR) {
            runRegisterMarket(symbol);
          }
        });
      };
      init();
    }
  }, depends);

  return mergeRequests(
    getMarket as null | RequestStatus<unknown>,
    registerMarket as null | RequestStatus<unknown>
  );
};

/* The loader is a screen that masks the application until all necessary
   contracts are deployed. Once we can verify that the application is usable,
   this screen disappears and users can interact with the protocol.
*/
const Loader = ({ children }: { children: ReactElement }): ReactElement => {
  /* We deploy the admin keyset and all the contracts in their required
  order. Each of these requests checks whether the deployment has already
  happened and, if so, skips the /send request. */
  const deployKeyset = useDeployCharkhaKeyset();
  const deployOracle = useDeployContract("free.charkha-oracle", oracleContract, [deployKeyset]);
  const deployKETH = useDeployContract("free.KETH", kethContract, [deployKeyset]);
  const deployMarketInterface = useDeployContract(
    "free.charkha-market-iface",
    marketInterfaceContract,
    [deployKeyset]
  );
  const deployControllerInterface = useDeployContract(
    "free.charkha-controller-iface",
    controllerInterfaceContract,
    [deployKeyset, deployMarketInterface]
  );
  const deployCHRK = useDeployContract("free.CHRK", chrkContract, [deployControllerInterface]);
  const deploycwKDA = useDeployContract("free.cwKDA", cwKDAContract, [deployControllerInterface]);
  const deploycwKETH = useDeployContract("free.cwKETH", cwKETHContract, [deploycwKDA]);
  const deploycwCHRK = useDeployContract("free.cwCHRK", cwCHRKContract, [deploycwKDA]);
  const deployGovernance = useDeployContract("free.charkha-governance", governanceContract, [
    deployCHRK,
  ]);
  const deployController = useDeployContract("free.charkha-controller", controllerContract, [
    deployGovernance,
  ]);

  /* Next, we'll ensure the price oracle has our assets registered with an-
  initial price. */
  const initOracleKDA = useRegisterOracleAsset("KDA", [deployOracle]);
  const initOracleKETH = useRegisterOracleAsset("KETH", [deployOracle]);
  const initOracleCHRK = useRegisterOracleAsset("CHRK", [deployOracle]);

  /* Next, we'll perform initialization by registering module references. In
  each case we'll check whether we need to initialize a reference and only send
  the initialization request if necessary. Each of our market contracts and the
  CHRK contract need a reference to the controller. */
  const initCHRK = useInitModuleReference(
    CHRK.isInitialized(),
    CHRK.init("free.charkha-controller"),
    [deployController]
  );
  const initcwKDA = useInitModuleReference(
    cwKDA.isInitialized(),
    cwKDA.init("free.charkha-controller"),
    [deployController]
  );
  const initcwKETH = useInitModuleReference(
    cwKETH.isInitialized(),
    cwKETH.init("free.charkha-controller"),
    [deployController]
  );
  const initcwCHRK = useInitModuleReference(
    cwCHRK.isInitialized(),
    cwCHRK.init("free.charkha-controller"),
    [deployController]
  );

  /* Finally, we can register our markets in the controller contract. */
  const registerKDAMarket = useRegisterMarket("KDA", [deployController]);
  const registerKETHMarket = useRegisterMarket("KETH", [deployController]);
  const registerCHRKMarket = useRegisterMarket("CHRK", [deployController]);

  const allSucceeded = [
    deployKeyset,
    deployOracle,
    deployKETH,
    deployMarketInterface,
    deployControllerInterface,
    deployCHRK,
    deploycwKDA,
    deploycwKETH,
    deploycwCHRK,
    deployGovernance,
    deployController,
    initCHRK,
    initcwKDA,
    initcwKETH,
    initcwCHRK,
    initOracleKDA,
    initOracleKETH,
    initOracleCHRK,
    registerKDAMarket,
    registerCHRKMarket,
    registerKETHMarket,
  ].reduce((acc, req) => (req ? acc && req.status === SUCCESS : false), true);

  /* Then, we'll start some long-running tasks (fetching oracle prices,
  refreshing the user state). First, we set up our oracle data from the
  CoinMarketCap API. This requires an API token to have been set in the .env
  file (see the development guide). We'll regularly pull from the oracle and
  update the oracle contract.

  The loader wraps the rest of the application, so it's OK to keep this long-
  running task in this component. */
  const cmcStore = useCoinMarketCapStore();
  const oracleStore = useOracleStore();
  const userStore = useUserStore();
  const marketStore = useMarketStore();

  const { initialized, setInitialized } = useAppStore();

  useEffect(() => {
    const loop = async () => {
      if (!initialized && allSucceeded) {
        setInitialized();
        syncState();
        while (true) {
          if (allSucceeded) {
            // Then we'll fetch new price data and update the oracle contract.
            await cmcStore.getPrices();
            const { lastPrices } = useCoinMarketCapStore.getState();
            const setPrice = (symbol: AssetName) =>
              pactAPI.send(
                oracle.setPrice({ symbol, price: { decimal: lastPrices[symbol].toFixed(13) } })
              );
            await Promise.allSettled([setPrice("KDA"), setPrice("KETH"), setPrice("CHRK")]);
            await oracleStore.getPrices();
            await userStore.getBorrowingCapacity();
          }
          await (async () => new Promise((resolve) => setTimeout(resolve, 240_000)))();
          continue;
        }
      }
    };
    loop();
  }, [initialized, allSucceeded]);

  /* One last thing: we'll make sure the application begins with some activity
  by having sender01 and sender02 participate in the markets, if they are not
  already */
  useEffect(() => {
    const run = async () => {
      const kdaMarket = marketStore.markets.get("KDA")!;
      if (kdaMarket.status === SUCCESS && kdaMarket.parsed.totalSupply === 0.0) {
        // First we'll have sender01 supply KDA to the market and sender02 will
        // lock up some ETH to mint KETH.
        await Promise.allSettled([
          await pactAPI
            .send(
              controller.supply({
                account: sender01Address,
                accountKeys: sender01KeyPair,
                market: "KDA",
                amount: { decimal: "12000.0" },
              })
            )
            .then((resp) => console.log("sender01 supply KDA", resp)),

          await pactAPI
            .send(
              KETH.mint({
                sender: sender02Address,
                senderKeys: sender02KeyPair,
                receiver: sender02Address,
                receiverGuard: sender02Keyset,
                amount: { decimal: "485.0" },
              })
            )
            .then((resp) => console.log("sender02 mint KETH", resp)),
        ]);

        await syncState();
      }

      const kethMarket = marketStore.markets.get("KDA")!;
      if (kethMarket.status === SUCCESS && kethMarket.parsed.totalSupply === 0.0) {
        // Then we'll have sender02 lend their KETH to the markets.
        await pactAPI
          .send(
            controller.supply({
              account: sender02Address,
              accountKeys: sender02KeyPair,
              market: "KETH",
              amount: { decimal: "50.0" },
            })
          )
          .then((resp) => console.log("sender02 supply KETH", resp)),
          await syncState();
      }

      // Finally, we'll have both senders take out borrows.
      if (kdaMarket.status === SUCCESS && kdaMarket.parsed.totalBorrows === 0.0) {
        await pactAPI
          .send(
            controller.borrow({
              account: sender01Address,
              accountKeys: sender01KeyPair,
              accountKeySet: sender01Keyset,
              market: "KETH",
              tokens: { decimal: "20.0" },
            })
          )
          .then((resp) => console.log("sender01 borrow KETH", resp)),
          await syncState();
      }

      if (kethMarket.status === SUCCESS && kethMarket.parsed.totalBorrows === 0.0) {
        await pactAPI
          .send(
            controller.borrow({
              account: sender02Address,
              accountKeys: sender02KeyPair,
              accountKeySet: sender02Keyset,
              market: "KDA",
              tokens: { decimal: "99500.0" },
            })
          )
          .then((resp) => console.log("sender02 borrow KDA", resp)),
          await syncState();
      }
    };

    if (initialized && allSucceeded) {
      run();
    }
  }, [initialized, allSucceeded]);

  /* Finally, we can render the loader or the application, depending on whether
  all requests have completed. */

  interface RequestRowProps {
    label: string;
    error?: string;
    children: ReactElement;
  }

  const RequestRow = ({ label, error, children }: RequestRowProps) => (
    <Box css={{ padding: "$1 0", marginTop: "$1" }}>
      <Flex css={{ alignItems: "center" }}>
        {children}
        <Text css={{ marginTop: "-2px", marginLeft: "$1" }}>{label}</Text>
      </Flex>
      {error ? <Text css={{ marginLeft: "$6", color: "$red9" }}>{error}</Text> : null}
    </Box>
  );

  const renderRequest = (
    label: string,
    request: RequestStatus<any> | null,
    omitError?: (error: string) => boolean
  ) => {
    if (request) {
      switch (request.status) {
        case PENDING:
          return (
            <RequestRow label={label}>
              <Spinner size="medium" />
            </RequestRow>
          );
        case REQUEST_ERROR:
          return (
            <RequestRow label={label} error={request.message}>
              <ErrorIcon size="medium" />
            </RequestRow>
          );
        // Some requests are expected to fail with an error, such as attempting
        // to reinitialize a contract reference.
        case EXEC_ERROR:
          if (omitError && omitError(request.response.result.error.message)) {
            return (
              <RequestRow label={label}>
                <SuccessIcon size="medium" />
              </RequestRow>
            );
          } else {
            return (
              <RequestRow
                label={label}
                error={
                  request.response.result.error.type + " " + request.response.result.error.message
                }
              >
                <ErrorIcon size="medium" />
              </RequestRow>
            );
          }
        case SUCCESS:
          return (
            <RequestRow label={label}>
              <SuccessIcon size="medium"></SuccessIcon>
            </RequestRow>
          );
        default:
          return (
            <RequestRow label={label} error={request}>
              <ErrorIcon size="medium" />
            </RequestRow>
          );
      }
    } else {
      return (
        <RequestRow label={label}>
          <NotStartedIcon size="medium" />
        </RequestRow>
      );
    }
  };

  return (
    <Container size="md">
      {cmcStore.error && <Text css={{ color: "$red9" }}>{cmcStore.error}</Text>}
      {allSucceeded ? (
        children
      ) : (
        <Box css={{ padding: "$8 $1" }}>
          <Header>Deployment</Header>
          <Text css={{ marginBottom: "$8" }}>
            You will only see this deployment screen when first deploying the Charkha protocol.
            Below, you can see the status each contract in the protocol as it is deployed to our
            local blockchain simulation. If you see an error on any step below then you may need to
            reset your devnet node to the snapshot state with 'devnet-clean'.{" "}
            <b>Deployment can take several minutes to complete.</b>
          </Text>
          <Container size="sm">
            {renderRequest("Deploy admin keyset", deployKeyset)}
            {renderRequest("Deploy oracle contract", deployOracle)}
            {renderRequest("Deploy KETH contract", deployKETH)}
            {renderRequest("Deploy market interface contract", deployMarketInterface)}
            {renderRequest("Deploy controller interface contract", deployControllerInterface)}
            {renderRequest("Deploy CHRK contract", deployCHRK)}
            {renderRequest("Deploy cwKDA contract", deploycwKDA)}
            {renderRequest("Deploy cwKETH contract", deploycwKETH)}
            {renderRequest("Deploy cwCHRK contract", deploycwCHRK)}
            {renderRequest("Deploy governance contract", deployGovernance)}
            {renderRequest("Deploy controller contract", deployController)}
            {renderRequest(
              "Initialize oracle contract with market prices for KDA, KETH, CHRK",
              mergeRequests(initOracleKDA, mergeRequests(initOracleKETH, initOracleCHRK))
            )}
            {renderRequest("Register controller reference in CHRK contract", initCHRK)}
            {renderRequest(
              "Register controller references in market contracts (cwKDA, cwKETH, cwCHRK)",
              mergeRequests(initcwKDA, mergeRequests(initcwKETH, initcwCHRK))
            )}
            {renderRequest(
              "Register KDA, KETH, CHRK markets in the controller contract",
              mergeRequests(
                registerKDAMarket,
                mergeRequests(registerKETHMarket, registerCHRKMarket)
              )
            )}
          </Container>
        </Box>
      )}
    </Container>
  );
};

export default Loader;
