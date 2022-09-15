/* ACCOUNT OVERVIEW

The account overview section uses the (coin.details) request to display balances
for the user's account across all chains.

*/

import { Box, Flex, Grid } from "@real-world-pact/theme/components/Container";
import { Spinner } from "@real-world-pact/theme/components/Spinner";
import { Header, Text } from "@real-world-pact/theme/components/Text";
import { userAccount } from "../accounts";
import * as coin from "../contracts/coin-v5";
import {
  EXEC_ERROR,
  PENDING,
  RequestStatus,
  REQUEST_ERROR,
  SUCCESS,
} from "../pact-utils/request-builder";

export interface AccountOverviewProps {
  balances: RequestStatus<coin.DetailsArgs, coin.DetailsResponse>[];
}

export const AccountOverview = ({ balances }: AccountOverviewProps) => {
  const description = `
    Your account is comprised of the public key from the public/private key pair
    generated for you by the wallet, with a k: prefix. This is called a k:account.
    This account doesn't exist on any chain until funds have been sent to it on
    that chain.
  `;

  return (
    <Box css={{ padding: "$8 $1" }}>
      <Header>Account</Header>
      <Flex css={{ justifyContent: "space-between" }}>
        <Text css={{ maxWidth: "66%", marginTop: "$2", color: "$mauve11" }}>{description}</Text>
        <Box css={{ marginLeft: "$8" }}>
          <Text
            css={{
              textAlign: "right",
              color: "$crimson11",
              paddingTop: 1,
              marginTop: "$2",
            }}
          >
            KDA Balance
          </Text>
          <Text css={{ fontSize: "$6xl", fontWeight: "bold", marginTop: "-$4" }}>
            {sumBalances(balances)}
          </Text>
        </Box>
      </Flex>
      <AccountTable balances={balances} />
    </Box>
  );
};

interface AccountTableProps {
  balances: RequestStatus<coin.DetailsArgs, coin.DetailsResponse>[];
}

const AccountTable = ({ balances }: AccountTableProps) => {
  // CSS grid lays items out in a left-to-right basis, but we want chains
  // ordered top-to-bottom.
  const lowerChains = balances.slice(0, 10);
  const orderedChains = lowerChains.flatMap((balance, ix) => [
    { chain: ix, balance },
    { chain: ix + 10, balance: balances[ix + 10] },
  ]);

  const Badge = () => (
    <Box
      as="span"
      css={{
        color: "$crimson1",
        backgroundColor: "$crimson11",
        width: "fit-content",
        borderTopLeftRadius: "8px",
        borderTopRightRadius: "8px",
        padding: "2px $3",
        fontWeight: "bold",
        fontSize: "$sm",
      }}
    >
      <Text>Account</Text>
    </Box>
  );

  const AccountBar = () => (
    <Flex
      css={{
        alignItems: "baseline",
        border: "2px solid $mauve12",
        borderBottom: "4px solid $mauve12",
        padding: "$3 $4",
        fontWeight: "bold",
        overflowX: "auto",
      }}
    >
      <Text as="pre">{userAccount.address}</Text>
    </Flex>
  );

  type TableRowArgs = {
    chain: number;
    balance: null | RequestStatus<coin.DetailsArgs, coin.DetailsResponse>;
  };

  const TableRow = ({ chain, balance }: TableRowArgs) => {
    const borderLeft = chain > 9 ? "none" : "2px solid $mauve12";
    const borderRight = chain > 9 ? "2px solid $mauve12" : "1px solid $mauve12";
    const borderBottom = chain === 9 || chain === 19 ? "2px solid $mauve12" : "1px solid $mauve12";

    const Balance = () => {
      if (!balance) {
        return <Text css={{ color: "$mauve9" }}>Not yet checked</Text>;
      }

      switch (balance.status) {
        case PENDING:
          return <Spinner />;

        case REQUEST_ERROR:
          return (
            <>
              <Text css={{ color: "$crimson12" }}>Request Error:</Text>;
              <br />
              <Text>{balance.message}</Text>;
            </>
          );

        case EXEC_ERROR:
          if (balance.response.result.error.message.includes("row not found")) {
            return <Text as="span">Does not exist</Text>;
          } else {
            return (
              <>
                <Text css={{ color: "$crimson12" }}>Transaction Error:</Text>
                <br />
                <Text>{balance.response.result.error.message}</Text>
              </>
            );
          }

        default:
          const amount = balance.parsed.balance;
          return (
            <Box css={{ fontWeight: "bold" }}>
              <Text as="span">{trimDecimal(amount)}</Text>
              <Text as="span" css={{ fontSize: "$2xs", color: "$crimson12" }}>
                {" "}
                KDA
              </Text>
            </Box>
          );
      }
    };

    return (
      <Flex
        css={{
          alignItems: "baseline",
          justifyContent: "space-between",
          borderLeft: `${borderLeft}`,
          borderBottom: `${borderBottom}`,
          borderRight: `${borderRight}`,
          padding: "$1 $4",
          fontSize: "$sm",
        }}
      >
        <Text>Chain {chain}</Text>
        <Balance />
      </Flex>
    );
  };

  return (
    <Flex css={{ flexDirection: "column", marginTop: "$6" }}>
      <Badge />
      <AccountBar />
      <Grid css={{ gridTemplateColumns: "1fr 1fr" }}>
        {orderedChains.map(({ balance, chain }) => (
          <TableRow key={chain} chain={chain} balance={balance} />
        ))}
      </Grid>
    </Flex>
  );
};

const trimDecimal = (n: number): number => {
  return Number(n.toFixed(6));
};

const sumBalances = (balances: RequestStatus<any, coin.DetailsResponse>[]) =>
  trimDecimal(
    balances
      .flatMap((req: RequestStatus<any, coin.DetailsResponse>) => {
        return req.status === SUCCESS ? [req.parsed.balance] : [];
      })
      .reduce((sum, current) => sum + current, 0.0)
  );
