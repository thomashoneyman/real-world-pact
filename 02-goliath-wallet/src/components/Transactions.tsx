/* TRANSACTIONS

The Transactions section lists out all transactions that have occurred between
the user account and the faucet account. Clicking on the details of any
transaction will pull up more information about the transfer. This section also
lists out the current per-request and per-account limits for the user.

*/

import * as Pact from "pact-lang-api";
import { ReactNode } from "react";
import { DetailsModal } from "@real-world-pact/theme/components/Modal/DetailsModal";
import { Box, Flex, Grid } from "@real-world-pact/theme/components/Container";
import { Header, Link, Text } from "@real-world-pact/theme/components/Text";
import { Spinner } from "@real-world-pact/theme/components/Spinner";
import { ErrorIcon, SuccessIcon } from "@real-world-pact/theme/components/Icon";

import * as faucet from "../contracts/goliath-faucet";
import {
  EXEC_ERROR,
  PENDING,
  RequestResult,
  RequestStatus,
  REQUEST_ERROR,
  Status,
  SUCCESS,
} from "../pact-utils/request-builder";

import { faucetAccount } from "../accounts";

// The 'Transactions' component is a container
export interface TransactionsProps {
  limits: null | RequestStatus<faucet.GetLimitsArgs, faucet.GetLimitsResponse>;
  transactions: RequestStatus<faucet.RequestFundsArgs | faucet.ReturnFundsArgs, string>[];
}

export const Transactions = ({ limits, transactions }: TransactionsProps) => {
  const description = `
    Transactions in a wallet list KDA transfers. Transfers can be between the same account on
    different chains or from one account to another on the same chain or on different chains. In
    Goliath you can transact with the "goliath-faucet" account via the faucet contract.
    `;

  const defaultLimits: faucet.GetLimitsResponse = {
    "account-limit": faucet.DEFAULT_ACCOUNT_LIMIT,
    "request-limit": faucet.DEFAULT_REQUEST_LIMIT,
    "account-limit-remaining": faucet.DEFAULT_ACCOUNT_LIMIT,
  };

  const parsedLimits: faucet.GetLimitsResponse =
    (limits && limits.status === SUCCESS && limits.parsed) || defaultLimits;

  const renderLimits = () => {
    const Key = ({ children }: { children: ReactNode }) => (
      <Text as="span" css={{ color: "$mauve11", fontSize: "$sm", marginRight: "$2" }}>
        {children}
      </Text>
    );

    const Value = ({ children }: { children: ReactNode }) => (
      <Text as="span" css={{ fontWeight: "bold" }}>
        {children}
      </Text>
    );

    return (
      <Box css={{ textAlign: "right" }}>
        <Text
          css={{
            color: "$crimson11",
            paddingTop: 1,
            marginTop: "$2",
          }}
        >
          Account Limits
        </Text>
        <div>
          <Key>Request Limit:</Key>
          <Value>{truncateDecimal(parsedLimits["request-limit"].toString())}</Value>
        </div>
        <div>
          <Key>Account Limit:</Key>
          <Value>{truncateDecimal(parsedLimits["account-limit"].toString())}</Value>
        </div>
        <div>
          <Key>KDA Remaining:</Key>
          <Value>{truncateDecimal(parsedLimits["account-limit-remaining"].toString())}</Value>
        </div>
      </Box>
    );
  };

  return (
    <Box css={{ padding: "$4 $1" }}>
      <Header>Transactions</Header>
      <Flex css={{ justifyContent: "space-between" }}>
        <Text css={{ maxWidth: "66%", margin: "$2 0 $6 0", color: "$mauve11" }}>{description}</Text>
        <Box css={{ marginLeft: "$8" }}>{renderLimits()}</Box>
      </Flex>
      {transactions.map((transaction, index) => (
        <Transaction key={index} transaction={transaction} />
      ))}
    </Box>
  );
};

interface TransactionProps {
  transaction: RequestStatus<faucet.RequestFundsArgs | faucet.ReturnFundsArgs, string>;
}

const Transaction = ({ transaction }: TransactionProps) => {
  const Labeled = ({ label, children }: any) => (
    <Box>
      <Text color="primary" css={{ fontSize: "$xs" }}>
        {label}
      </Text>
      <Text css={{ fontWeight: "bold", fontSize: "$sm" }}>{children}</Text>
    </Box>
  );

  const row = transactionToRow(transaction);

  const status: ReactNode = (() => {
    switch (row.status) {
      case PENDING:
        return <Spinner />;
      case REQUEST_ERROR:
        return <ErrorIcon size="medium" />;
      case EXEC_ERROR:
        return <ErrorIcon size="medium" />;
      case SUCCESS:
        return <SuccessIcon size="medium" />;
    }
  })();

  return (
    <Grid
      css={{
        gridTemplateColumns: "1fr 1fr 2fr 2fr 1fr",
        alignItems: "center",
        border: "2px solid $mauve12",
        marginBottom: "$4",
        padding: "$1 $4",
      }}
    >
      <Labeled label="Status">{status}</Labeled>
      <Labeled label="Amount">{truncateDecimal(row.amount.decimal)}</Labeled>
      <Labeled label="From">{truncateString(row.from)}</Labeled>
      <Labeled label="To">{truncateString(row.to)}</Labeled>
      <Labeled label="Details">{row.details}</Labeled>
    </Grid>
  );
};

interface TransactionRow {
  status: Status;
  amount: Pact.PactDecimal;
  from: string;
  to: string;
  details: ReactNode;
}

const transactionToRow = (
  transaction: RequestStatus<faucet.RequestFundsArgs | faucet.ReturnFundsArgs, string>
): TransactionRow => {
  const isRequestFunds = (tx: any): tx is RequestStatus<faucet.RequestFundsArgs, string> =>
    !tx.input.accountKeys;

  const isReturnFunds = (tx: any): tx is RequestStatus<faucet.ReturnFundsArgs, string> =>
    tx.input.accountKeys;

  const transactionResult =
    transaction.status === PENDING ? <Spinner /> : <TransactionDetails transaction={transaction} />;

  if (isReturnFunds(transaction)) {
    return {
      status: transaction.status,
      details: transactionResult,
      from: transaction.input.account,
      to: faucetAccount.address,
      amount: transaction.input.amount,
    };
  } else if (isRequestFunds(transaction)) {
    return {
      status: transaction.status,
      details: transactionResult,
      from: faucetAccount.address,
      to: transaction.input.targetAddress,
      amount: transaction.input.amount,
    };
  } else {
    throw new Error("Unexpected transaction.");
  }
};

interface TransactionDetailsProps {
  transaction: RequestResult<faucet.RequestFundsArgs | faucet.ReturnFundsArgs, string>;
}

const TransactionDetails = ({ transaction }: TransactionDetailsProps) => {
  const Label = ({ children }: { children: ReactNode }) => (
    <Text css={{ fontSize: "$xs", color: "$crimson11" }}>{children}</Text>
  );

  return (
    <DetailsModal
      title="Transaction Details"
      description="Transactions, whether they fail or succeed, contain plenty of metadata."
      trigger={<Link>See Details</Link>}
      confirmLabel="Done"
    >
      <Box>
        <Label>Status</Label>
        <Text>{transaction.status}</Text>
        <br />
        {transaction.status === REQUEST_ERROR && (
          <Box>
            <Label>Error Contents</Label>
            <Text>{transaction.message}</Text>
            <br />
          </Box>
        )}
        {transaction.status === EXEC_ERROR && (
          <Box>
            <Label>Error Contents</Label>
            <Text>{JSON.stringify(transaction.response.result.error)}</Text>
            <br />
          </Box>
        )}
        {transaction.status === SUCCESS && (
          <Box>
            <Label>Success Contents</Label>
            <Text>{JSON.stringify(transaction.parsed)}</Text>
            <br />
          </Box>
        )}
        <Label>Pact Code</Label>
        <Text>{transaction.request.pactCode}</Text>
        <br />
        {transaction.request.envData && (
          <Box>
            <Label>Env Data</Label>
            <Text>{JSON.stringify(transaction.request.envData)}</Text>
            <br />
          </Box>
        )}
        {transaction.request.keyPairs && (
          <Box>
            <Label>Key Pairs</Label>
            <Text>{JSON.stringify(transaction.request.keyPairs, undefined, 2)}</Text>
            <br />
          </Box>
        )}
        <Label>Metadata</Label>
        <Text>{JSON.stringify(transaction.request.meta)}</Text>
      </Box>
    </DetailsModal>
  );
};

const truncateDecimal = (str: string) => {
  if (str.length > 8) {
    return str.slice(0, 8);
  } else {
    return str;
  }
};

const truncateString = (str: string) => {
  if (str.length >= 24) {
    return `${str.slice(0, 21)}...`;
  } else {
    return str;
  }
};
