import * as Pact from "pact-lang-api";
import { Box, Grid } from "@real-world-pact/theme/components/Container";
import { Header, Text } from "@real-world-pact/theme/components/Text";
import * as faucet from "../contracts/goliath-faucet";
import { PENDING, RequestStatus, Status } from "../pact-utils/request-builder";
import { faucetAccount } from "../accounts";
import { ReactNode } from "react";
import { Spinner } from "@real-world-pact/theme/components/Spinner";

export interface TransactionProps {
  transactions: RequestStatus<faucet.RequestFundsArgs | faucet.ReturnFundsArgs, string>[];
}

export const Transactions = ({ transactions }: TransactionProps) => {
  const description = `
    Transactions in a wallet indicate a transfer of KDA from one account on one
    chain to either the same account on a different chain, or a different account
    on the same or a different chain.
  `;

  return (
    <Box css={{ padding: "$4 $1" }}>
      <Header>Transactions</Header>
      <Text css={{ maxWidth: "66%", margin: "$2 0 $6 0", color: "$mauve11" }}>{description}</Text>
      {transactions.map((transaction, index) => (
        <TransferCard key={index} transaction={transaction} />
      ))}
    </Box>
  );
};

interface TransactionCardProps {
  transaction: RequestStatus<faucet.RequestFundsArgs | faucet.ReturnFundsArgs, string>;
}

interface Row {
  status: Status;
  amount: Pact.PactDecimal;
  from: string;
  to: string;
  type: string;
}

const parseRow = (
  transaction: RequestStatus<faucet.RequestFundsArgs | faucet.ReturnFundsArgs, string>
): Row => {
  const isRequestFunds = (tx: any): tx is RequestStatus<faucet.RequestFundsArgs, string> =>
    !tx.input.accountKeys;

  const isReturnFunds = (tx: any): tx is RequestStatus<faucet.ReturnFundsArgs, string> =>
    tx.input.accountKeys;

  if (isReturnFunds(transaction)) {
    return {
      status: transaction.status,
      type: "RETURN FUNDS",
      from: transaction.input.account,
      to: faucetAccount.address,
      amount: transaction.input.amount,
    };
  } else if (isRequestFunds(transaction)) {
    return {
      status: transaction.status,
      type: "REQUEST FUNDS",
      from: faucetAccount.address,
      to: transaction.input.targetAddress,
      amount: transaction.input.amount,
    };
  } else {
    throw new Error("Unexpected transaction.");
  }
};

const TransferCard = ({ transaction }: TransactionCardProps) => {
  const Labeled = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
    <Box>
      <Text color="primary" css={{ fontSize: "$xs", marginBottom: "-$1" }}>
        {label}
      </Text>
      <Text css={{ fontWeight: "bold", fontSize: "$sm" }}>{children}</Text>
    </Box>
  );

  const row = parseRow(transaction);

  const status: ReactNode = (() => {
    if (row.status === PENDING) {
      return <Spinner />;
    } else {
      return row.status;
    }
  })();

  return (
    <Grid
      css={{
        gridTemplateColumns: "1fr 1fr 2fr 2fr 2fr",
        alignItems: "center",
        border: "2px solid $mauve12",
        marginBottom: "$4",
        padding: "$1 $4",
      }}
    >
      <Labeled label="Status">{status}</Labeled>
      <Labeled label="Amount">{row.amount.decimal}</Labeled>
      <Labeled label="From">{row.from}</Labeled>
      <Labeled label="To">{row.to}</Labeled>
      <Labeled label="Type">{row.type}</Labeled>
    </Grid>
  );
};
