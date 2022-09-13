import { Button } from "@real-world-pact/theme/components/Button";
import { Flex } from "@real-world-pact/theme/components/Container";
import { Fieldset, Input, Label } from "@real-world-pact/theme/components/Form";
import ActionModal from "@real-world-pact/theme/components/Modal";
import { Link, Text } from "@real-world-pact/theme/components/Text";

import { useFormik } from "formik";
import { useState } from "react";

import * as faucet from "../contracts/goliath-faucet";
import { RequestStatus } from "../pact-utils/request-builder";

export interface AdminModalProps extends React.ComponentPropsWithoutRef<any> {
  limits: RequestStatus<any, faucet.GetLimitsResponse> | null;
}

export const AdminModal = ({ limits, ...props }: AdminModalProps) => {
  const [open, setOpen] = useState(false);

  const formik = useFormik({
    initialValues: { amount: "0.0" },
    onSubmit: (_) => {
      setOpen(false);
    },
  });

  const title = "Faucet Contract Admin";

  const description = (
    <>
      <Text>
        The faucet smart contract has controls that allow the faucet account to raise or lower the
        per-account and per-request limits. You can act as the faucet account and change those
        limits.
      </Text>
      <br />
      <Text>Current per-request max: {limits?.status}</Text>
      <Text>Current per-account max: {limits?.status}</Text>
    </>
  );

  const triggerButton = (
    <Link {...props} onClick={() => setOpen(true)}>
      Admin
    </Link>
  );

  return (
    <ActionModal title={title} description={description} triggerButton={triggerButton} open={open}>
      <form onSubmit={formik.handleSubmit}>
        <Fieldset>
          <Label htmlFor="name">Chain</Label>
          <Input id="name" defaultValue="Chain 1" />
        </Fieldset>
        <Flex css={{ marginTop: "$8", justifyContent: "flex-end" }}>
          <Button variant="primary" type="submit">
            Send Transaction
          </Button>
        </Flex>
      </form>
    </ActionModal>
  );
};

export interface ReceiveModalProps extends React.ComponentPropsWithoutRef<any> {
  limits: RequestStatus<any, faucet.GetLimitsResponse> | null;
  onSubmit: (amount: number) => Promise<void>;
}

export const ReceiveModal = ({
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
        Other Kadena addresses can send their KDA to you. You simply need to share your account
        address with them (your k: account). However, we've built a smart contract that you can ask
        to send you funds. This smart contract limits how much KDA it will send you per request and
        the total KDA it will send to any account. However, you can change these limits using the
        Admin section in the navbar. If you reach your limit, try raising it!
      </Text>
      <br />
      <Text>Current per-request max: {requestLimit}</Text>
      <Text>Current per-account max: {accountLimit}</Text>
    </>
  );

  const triggerButton = (
    <Button variant="secondary" outlined {...props} onClick={() => setOpen(true)}>
      Receive KDA
    </Button>
  );

  return (
    <ActionModal title={title} description={description} triggerButton={triggerButton} open={open}>
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
        <Flex css={{ marginTop: "$8", justifyContent: "flex-end" }}>
          <Button variant="primary" type="submit">
            Send Transaction
          </Button>
        </Flex>
      </form>
    </ActionModal>
  );
};

export const SendModal = () => {
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
      You can send a transfer by calling the coin.transfer contract on Chainweb. That's what we do
      here.
    </Text>
  );

  const triggerButton = <Button variant="primary">Send KDA</Button>;

  return (
    <ActionModal title={title} description={description} triggerButton={triggerButton} open={open}>
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
        <Flex css={{ marginTop: "$8", justifyContent: "flex-end" }}>
          <Button variant="primary" type="submit">
            Send Transaction
          </Button>
          ;
        </Flex>
      </form>
    </ActionModal>
  );
};
