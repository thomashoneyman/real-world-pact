import React, { ReactNode, useEffect, useState } from "react";

import { Button } from "@real-world-pact/theme/components/Button";
import * as Container from "@real-world-pact/theme/components/Container";
import { Fieldset, Input, Label } from "@real-world-pact/theme/components/Form";
import { GlobalStyles } from "@real-world-pact/theme/components/GlobalStyles";
import { ActionModal } from "@real-world-pact/theme/components/Modal";
import { Navbar } from "@real-world-pact/theme/components/Navbar";
import { Header, Link, Text } from "@real-world-pact/theme/components/Text";
import { Spinner } from "@real-world-pact/theme/components/Spinner";

import { useFormik } from "formik";

import * as Pact from "pact-lang-api";
import * as coin from "@real-world-pact/pact-api-utils/contracts/coin-v4";
import {
  EXEC_ERROR,
  PENDING,
  REQUEST_ERROR,
  TransactionStatus,
  useSendPoll,
} from "@real-world-pact/pact-api-utils/transaction";

import * as goliathFaucet from "./goliath-faucet";
import * as config from "./config";
import { apiHost } from "@real-world-pact/pact-api-utils/request-utils";

/* UTILITIES */

// In our UI we'd like to be able to track the status of a request from the time
// we send it until we receive a valid result. We can use this type to track the
// request in state.
type RequestStatus<a> =
  | { status: "NOT_SENT" }
  | { status: "LOADING" }
  | { status: "ERROR"; error: string }
  | { status: "RESULT"; result: a };

const useLocalCmd = () => {
  const [status, setStatus] = useState<RequestStatus<Pact.LocalResponse>>({
    status: "NOT_SENT",
  });

  const req = async (cmd: Pact.LocalCmd) => {
    try {
      const res = await Pact.fetch.local(cmd, apiHost(cmd.meta.chainId));
      if (typeof res === "string") {
        setStatus({ status: "ERROR", error: res });
      } else {
        setStatus({ status: "RESULT", result: res });
      }
    } catch (err) {
      setStatus({ status: "ERROR", error: `${err}` });
    }
  };

  return { send: req, status };
};

const useLocalCmdAllChains = function (
  cmdChain: (chainId: string) => Pact.LocalCmd
) {
  const [statuses, setStatuses] = useState<
    Array<RequestStatus<Pact.LocalResponse>>
  >(
    Array.from({ length: 20 }, (_) => {
      return { status: "NOT_SENT" };
    })
  );

  const execLocalCmd = async (cmd: Pact.LocalCmd, index: number) => {
    const update = (newStatus: RequestStatus<Pact.LocalResponse>) => {
      setStatuses((statuses) => {
        const copy = Array.from(statuses);
        copy[index] = newStatus;
        return copy;
      });
    };

    try {
      const res = await Pact.fetch.local(cmd, apiHost(cmd.meta.chainId));
      if (typeof res === "string") {
        update({ status: "ERROR", error: res });
      } else {
        update({ status: "RESULT", result: res });
      }
    } catch (err) {
      update({ status: "ERROR", error: `${err}` });
    }
  };

  const localCmdAllChains = () => {
    setStatuses((statuses) =>
      statuses.map((_) => {
        return { status: "LOADING" };
      })
    );

    return Promise.all(
      statuses.map((_, index) =>
        execLocalCmd(cmdChain(index.toString()), index)
      )
    );
  };

  return { statuses, localCmdAllChains };
};

const trimDecimal = (n: number): number => {
  return Number(n.toFixed(6));
};

const App = () => {
  const [txs, setTxs] = useState<Array<TransactionStatus<any, any>>>([]);

  const getBalances = useLocalCmdAllChains((c) =>
    coin.details({
      sender: config.userAccount.address,
      address: config.userAccount.address,
      chainId: c,
    })
  );

  const getLimits = useLocalCmd();

  const requestFunds = async (args: goliathFaucet.IRequestFunds) => {
    await useSendPoll(goliathFaucet.requestFundsCmd, setTxs)(args);
    await getBalances.localCmdAllChains();
  };

  useEffect(() => {
    (async () => {
      await getBalances.localCmdAllChains();
      await requestFunds({
        targetAccount: config.userAccount.address,
        targetAccountKeySet: config.userKeyset,
        amount: { decimal: "15.0" },
        chainId: "0",
      });
      await getLimits.send(
        goliathFaucet.getLimits({
          account: config.userAccount.address,
          chainId: "0",
        })
      );
      console.log(getLimits.status);
    })();
  }, []);

  const kdaAmount = trimDecimal(
    getBalances.statuses
      .flatMap((status: RequestStatus<Pact.LocalResponse>) => {
        if (
          status.status === "RESULT" &&
          status.result.result.status === "success"
        ) {
          return [
            JSON.parse(JSON.stringify(status.result.result.data))
              .balance as number,
          ];
        } else {
          return [];
        }
      }) // filter nulls
      .reduce((sum, current) => sum + current, 0.0)
  );

  return (
    <GlobalStyles>
      <Container.Box css={{ padding: "0 $1" }}>
        <Navbar>
          <Container.Flex css={{ alignItems: "center" }}>
            <AdminModal
              accountLimit={50.0}
              requestLimit={20.0}
              css={{ marginRight: "$3" }}
            />
            <ReceiveModal
              accountLimit={50.0}
              requestLimit={20.0}
              css={{ marginRight: "$2" }}
              onSubmit={async (amount) => {
                await requestFunds({
                  targetAccount: config.userAccount.address,
                  targetAccountKeySet: config.userKeyset,
                  amount: { decimal: amount.toString() },
                  chainId: "0",
                });
              }}
            />
            <SendModal />
          </Container.Flex>
        </Navbar>
        <Container.Container size="md">
          <Account
            kAccount={config.userAccount.address}
            kdaAmount={kdaAmount}
            balances={getBalances.statuses}
          />
          <Transactions transactions={Array.from(txs).reverse()} />
        </Container.Container>
      </Container.Box>
    </GlobalStyles>
  );
};

interface AdminModalProps extends React.ComponentPropsWithoutRef<any> {
  accountLimit: number;
  requestLimit: number;
}

const AdminModal = ({
  accountLimit,
  requestLimit,
  ...props
}: AdminModalProps) => {
  const [open, setOpen] = useState(false);

  const formik = useFormik({
    initialValues: { amount: requestLimit },
    onSubmit: (values) => {
      setOpen(false);
    },
  });

  const title = "Faucet Contract Admin";

  const description = (
    <>
      <Text>
        The faucet smart contract has controls that allow the faucet account to
        raise or lower the per-account and per-request limits. You can act as
        the faucet account and change those limits.
      </Text>
      <br />
      <Text>Current per-request max: {requestLimit}</Text>
      <Text>Current per-account max: {accountLimit}</Text>
    </>
  );

  const triggerButton = (
    <Link {...props} onClick={() => setOpen(true)}>
      Admin
    </Link>
  );

  return (
    <ActionModal
      title={title}
      description={description}
      triggerButton={triggerButton}
      open={open}
    >
      <form onSubmit={formik.handleSubmit}>
        <Fieldset>
          <Label htmlFor="name">Chain</Label>
          <Input id="name" defaultValue="Chain 1" />
        </Fieldset>
        <Container.Flex css={{ marginTop: "$8", justifyContent: "flex-end" }}>
          <Button variant="primary" type="submit">
            Send Transaction
          </Button>
        </Container.Flex>
      </form>
    </ActionModal>
  );
};

interface ReceiveModalProps extends React.ComponentPropsWithoutRef<any> {
  accountLimit: number;
  requestLimit: number;
  onSubmit: (amount: number) => Promise<void>;
}

const ReceiveModal = ({
  requestLimit,
  accountLimit,
  onSubmit,
  ...props
}: ReceiveModalProps) => {
  const [open, setOpen] = useState(false);

  const formik = useFormik({
    initialValues: { amount: requestLimit },
    onSubmit: (values) => {
      setOpen(false);
      return onSubmit(values.amount);
    },
  });

  const title = "Receive KDA";

  const description = (
    <>
      <Text>
        Other Kadena addresses can send their KDA to you. You simply need to
        share your account address with them (your k: account). However, we've
        built a smart contract that you can ask to send you funds. This smart
        contract limits how much KDA it will send you per request and the total
        KDA it will send to any account. However, you can change these limits
        using the Admin section in the navbar. If you reach your limit, try
        raising it!
      </Text>
      <br />
      <Text>Current per-request max: {requestLimit}</Text>
      <Text>Current per-account max: {accountLimit}</Text>
    </>
  );

  const triggerButton = (
    <Button
      variant="secondary"
      outlined
      {...props}
      onClick={() => setOpen(true)}
    >
      Receive KDA
    </Button>
  );

  return (
    <ActionModal
      title={title}
      description={description}
      triggerButton={triggerButton}
      open={open}
    >
      <form onSubmit={formik.handleSubmit}>
        <Fieldset>
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            onChange={formik.handleChange}
            value={formik.values.amount}
          />
        </Fieldset>
        <Container.Flex css={{ marginTop: "$8", justifyContent: "flex-end" }}>
          <Button variant="primary" type="submit">
            Send Transaction
          </Button>
        </Container.Flex>
      </form>
    </ActionModal>
  );
};

const SendModal = () => {
  const [open, setOpen] = useState(false);

  const formik = useFormik({
    initialValues: { address: "", amount: 0.0 },
    onSubmit: (values) => {
      setOpen(false);
    },
  });

  const title = "Send KDA";

  const description = (
    <Text>
      You can send a transfer by calling the coin.transfer contract on Chainweb.
      That's what we do here.
    </Text>
  );

  const triggerButton = <Button variant="primary">Send KDA</Button>;

  return (
    <ActionModal
      title={title}
      description={description}
      triggerButton={triggerButton}
      open={open}
    >
      <form onSubmit={formik.handleSubmit}>
        <Fieldset>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            name="address"
            onChange={formik.handleChange}
            value={formik.values.address}
          />
        </Fieldset>
        <Fieldset>
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            onChange={formik.handleChange}
            value={formik.values.amount}
          />
        </Fieldset>
        <Container.Flex css={{ marginTop: "$8", justifyContent: "flex-end" }}>
          <Button variant="primary" type="submit">
            Send Transaction
          </Button>
          ;
        </Container.Flex>
      </form>
    </ActionModal>
  );
};

interface AccountProps {
  kAccount: string;
  kdaAmount: number;
  balances: Array<RequestStatus<Pact.LocalResponse>>;
}

const Account = ({ kAccount, kdaAmount, balances }: AccountProps) => {
  const description = `
    Your account is comprised of the public key from the public/private key pair
    generated for you by the wallet, with a k: prefix. This is called a k:account.
    This account doesn't exist on any chain until funds have been sent to it on
    that chain.
  `;

  return (
    <Container.Box css={{ padding: "$8 $1" }}>
      <Header>Account</Header>
      <Container.Flex css={{ justifyContent: "space-between" }}>
        <Text css={{ maxWidth: "66%", marginTop: "$2", color: "$mauve11" }}>
          {description}
        </Text>
        <Container.Box css={{ marginLeft: "$8" }}>
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
          <Text
            css={{ fontSize: "$6xl", fontWeight: "bold", marginTop: "-$4" }}
          >
            {kdaAmount}
          </Text>
        </Container.Box>
      </Container.Flex>
      <AccountTable kAccount={kAccount} balances={balances} />
    </Container.Box>
  );
};

interface AccountTableProps {
  kAccount: string;
  balances: Array<RequestStatus<Pact.LocalResponse>>;
}

const AccountTable = ({ kAccount, balances }: AccountTableProps) => {
  // CSS grid lays items out in a left-to-right basis, but we want chains
  // ordered top-to-bottom.
  const lowerChains = balances.slice(0, 10);
  const orderedChains = lowerChains.flatMap((balance, ix) => [
    { chain: ix, balance },
    { chain: ix + 10, balance: balances[ix + 10] },
  ]);

  const Badge = () => (
    <Container.Box
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
    </Container.Box>
  );

  const AccountBar = () => (
    <Container.Flex
      css={{
        alignItems: "baseline",
        border: "2px solid $mauve12",
        borderBottom: "4px solid $mauve12",
        padding: "$3 $4",
        fontWeight: "bold",
        overflowX: "auto",
      }}
    >
      <Text as="pre">{kAccount}</Text>
    </Container.Flex>
  );

  const TableRow = ({
    chain,
    balance,
  }: {
    chain: number;
    balance: RequestStatus<Pact.LocalResponse>;
  }) => {
    const borderLeft = chain > 9 ? "none" : "2px solid $mauve12";
    const borderRight = chain > 9 ? "2px solid $mauve12" : "1px solid $mauve12";
    const borderBottom =
      chain === 9 || chain === 19 ? "2px solid $mauve12" : "1px solid $mauve12";

    const Balance = () => {
      if (balance.status === "NOT_SENT") {
        return <Text css={{ color: "$mauve9" }}>Not yet checked</Text>;
      } else if (balance.status === "LOADING") {
        return <Spinner />;
      } else if (balance.status === "ERROR") {
        return (
          <Text css={{ color: "$crimson12" }}>
            Network Error: {balance.error}
          </Text>
        );
      } else if (balance.result.result.status === "failure") {
        if (balance.result.result.error.message.includes("row not found")) {
          return <Text as="span">Does not exist</Text>;
        } else {
          return (
            <Text css={{ color: "$crimson12" }}>
              Transaction Error: ${balance.result.result.error.message}
            </Text>
          );
        }
      } else {
        const amount: number = JSON.parse(
          JSON.stringify(balance.result.result.data)
        ).balance;
        return (
          <Container.Box css={{ fontWeight: "bold" }}>
            <Text as="span">{trimDecimal(amount)}</Text>
            <Text as="span" css={{ fontSize: "$2xs", color: "$crimson12" }}>
              {" "}
              KDA
            </Text>
          </Container.Box>
        );
      }
    };

    return (
      <Container.Flex
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
      </Container.Flex>
    );
  };

  return (
    <Container.Flex css={{ flexDirection: "column", marginTop: "$6" }}>
      <Badge />
      <AccountBar />
      <Container.Grid css={{ gridTemplateColumns: "1fr 1fr" }}>
        {orderedChains.map(({ balance, chain }) => (
          <TableRow key={chain} chain={chain} balance={balance} />
        ))}
      </Container.Grid>
    </Container.Flex>
  );
};

interface TransactionProps {
  transactions: TransactionStatus<
    coin.ITransferCreate | goliathFaucet.IRequestFunds,
    void
  >[];
}

const Transactions = ({ transactions }: TransactionProps) => {
  const description = `
    Transactions in a wallet indicate a transfer of KDA from one account on one
    chain to either the same account on a different chain, or a different account
    on the same or a different chain.
  `;

  return (
    <Container.Box css={{ padding: "$4 $1" }}>
      <Header>Transactions</Header>
      <Text css={{ maxWidth: "66%", margin: "$2 0 $6 0", color: "$mauve11" }}>
        {description}
      </Text>
      {transactions.map((transaction, index) => (
        <TransferCard key={index} transaction={transaction} />
      ))}
    </Container.Box>
  );
};

interface TransactionCardProps {
  transaction: TransactionStatus<
    coin.ITransferCreate | goliathFaucet.IRequestFunds,
    void
  >;
}

const TransferCard = ({ transaction }: TransactionCardProps) => {
  const Labeled = ({
    label,
    children,
  }: {
    label: ReactNode;
    children: ReactNode;
  }) => (
    <Container.Box>
      <Text color="primary" css={{ fontSize: "$xs", marginBottom: "-$1" }}>
        {label}
      </Text>
      <Text css={{ fontWeight: "bold", fontSize: "$sm" }}>{children}</Text>
    </Container.Box>
  );

  const { from, to }: { from: React.ReactNode; to: React.ReactNode } = (() => {
    const isCreate = (p: any): p is coin.ITransferCreate =>
      p.hasOwnProperty("sourceAccount");
    if (isCreate(transaction.args)) {
      return {
        from: `${transaction.args.sourceAccount.address.slice(0, 8)} (Chain ${
          transaction.args.chainId
        })`,
        to: `${transaction.args.targetAccount.address.slice(0, 8)}... (Chain ${
          transaction.args.chainId
        })`,
      };
    } else {
      return {
        from: `${goliathFaucet.FAUCET_ACCOUNT} (Chain ${transaction.args.chainId})`,
        to: `${transaction.args.targetAccount.slice(0, 8)}... (Chain ${
          transaction.args.chainId
        })`,
      };
    }
  })();

  const {
    status,
    timestamp,
  }: { status: React.ReactNode; timestamp: React.ReactNode } = (() => {
    switch (transaction.type) {
      case PENDING:
        return { status: <Spinner />, timestamp: <Spinner /> };

      case REQUEST_ERROR:
        return {
          status: "Request Error",
          timestamp: `${transaction.cmd.meta.creationTime}`,
        };

      case EXEC_ERROR:
        return {
          status: "Failed",
          timestamp: `${transaction.result.metaData.blockTime}`,
        };

      default:
        return {
          status: "Success",
          timestamp: `${transaction.result.metaData.blockTime}`,
        };
    }
  })();

  return (
    <Container.Grid
      css={{
        gridTemplateColumns: "1fr 1fr 2fr 2fr 2fr",
        alignItems: "center",
        border: "2px solid $mauve12",
        marginBottom: "$4",
        padding: "$1 $4",
      }}
    >
      <Labeled label="Status">{status}</Labeled>
      <Labeled label="Amount">{transaction.args.amount.decimal}</Labeled>
      <Labeled label="From">{from}</Labeled>
      <Labeled label="To">{to}</Labeled>
      <Labeled label="Timestamp">{timestamp}</Labeled>
    </Container.Grid>
  );
};

export default App;
