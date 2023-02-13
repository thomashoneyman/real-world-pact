/* TRANSACTIONS

The Transactions section lists out all transactions that have occurred between
the user account and the faucet account. Clicking on the details of any
transaction will pull up more information about the transfer. This section also
lists out the current per-request and per-account limits for the user.

*/

import * as Pact from "pact-lang-api";
import { ReactNode, useState } from "react";
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
  SendRequest,
  SUCCESS,
} from "@real-world-pact/utils/pact-request";
import { pactAPI } from "../pact-api";

export interface Transaction {
  request: RequestStatus<any>;
  amount: Pact.PactDecimal;
  from: string;
  to: string;
}

export interface TransactionsProps {
  limits: null | RequestStatus<faucet.GetLimitsResponse>;
  transactions: Transaction[];
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
  transaction: Transaction;
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

  const status: ReactNode = (() => {
    switch (transaction.request.status) {
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
      <Labeled label="Amount">{truncateDecimal(transaction.amount.decimal)}</Labeled>
      <Labeled label="From">{truncateString(transaction.from)}</Labeled>
      <Labeled label="To">{truncateString(transaction.to)}</Labeled>
      <Labeled label="Details">
        <TransactionDetails transaction={transaction} />
      </Labeled>
    </Grid>
  );
};

interface TransactionDetailsProps {
  transaction: Transaction;
}

const TransactionDetails = ({ transaction }: TransactionDetailsProps) => {
  const Label = ({ children }: { children: ReactNode }) => (
    <Text css={{ fontSize: "$xs", color: "$crimson11" }}>{children}</Text>
  );

  const response: ReactNode = (() => {
    switch (transaction.request.status) {
      case PENDING:
        return (
          <Box>
            <Label>Response Contents</Label>
            <Spinner />
          </Box>
        );
      case REQUEST_ERROR:
        return (
          <Box>
            <Label>Error Contents</Label>
            <Text>{transaction.request.message}</Text>
          </Box>
        );
      case EXEC_ERROR:
        return (
          <Box>
            <Label>Error Contents</Label>
            <Text>{JSON.stringify(transaction.request.response.result.error)}</Text>
          </Box>
        );
      case SUCCESS:
        return (
          <Box>
            <Label>Success Contents</Label>
            <Text>{JSON.stringify(transaction.request.parsed)}</Text>
          </Box>
        );
    }
  })();

  return (
    <DetailsModal
      title="Transaction Details"
      description="Transactions, whether they fail or succeed, contain plenty of metadata."
      trigger={<Link>See Details</Link>}
      confirmLabel="Done"
    >
      <Box>
        <Label>Status</Label>
        <Text>{transaction.request.status}</Text>
        <br />
        {response}
        <br />
        <Label>Pact Code</Label>
        <Text>{transaction.request.request.pactCode}</Text>
        <br />
        {transaction.request.request.envData && (
          <Box>
            <Label>Env Data</Label>
            <Text>{JSON.stringify(transaction.request.request.envData)}</Text>
            <br />
          </Box>
        )}
        {transaction.request.request.keyPairs && (
          <Box>
            <Label>Key Pairs</Label>
            <Text>{JSON.stringify(transaction.request.request.keyPairs, undefined, 2)}</Text>
            <br />
          </Box>
        )}
        <Label>Metadata</Label>
        <Text>{JSON.stringify(transaction.request.request.meta)}</Text>
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

// A Hook that lets you submit requests representing transactions that should
// be displayed in the UI and will record their statuses (most recent listed first)
export const useTransactions = (): [
  Transaction[],
  <a>(
    req: SendRequest<a>,
    amount: Pact.PactDecimal,
    from: string,
    to: string
  ) => Promise<RequestResult<a>>
] => {
  const [txs, setTxs] = useState<Transaction[]>([]);

  const newTransaction = function <a>(
    req: SendRequest<a>,
    amount: Pact.PactDecimal,
    from: string,
    to: string
  ): Promise<RequestResult<a>> {
    // Local requests return quickly, but transactions take a while to be mined.
    // It's possible that several transactions are initiated before the prior
    // transactions complete, so we need to track the position of a particular
    // request in the closure.
    let id: number;

    const handleStatusChange = (newStatus: RequestStatus<any>) => {
      switch (newStatus.status) {
        // When we receive a PENDING status, that means the request has been
        // initiated and we should insert it at the beginning of the array.
        case PENDING:
          setTxs((oldTxs) => {
            const copy = Array.from(oldTxs);
            id = copy.length;
            copy.push({ amount, from, to, request: newStatus });
            return copy;
          });
          break;

        // Otherwise, we've received a non-pending status and we should update the
        // array at the index we previously stored.
        default:
          setTxs((oldTxs) => {
            const copy = Array.from(oldTxs);
            copy[id] = { amount, from, to, request: newStatus };
            return copy;
          });
          break;
      }
    };

    return pactAPI.sendWithCallback(req, handleStatusChange);
  };

  return [Array.from(txs).reverse(), newTransaction];
};
