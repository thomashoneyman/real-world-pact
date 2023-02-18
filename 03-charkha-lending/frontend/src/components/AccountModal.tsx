import { Button } from "@real-world-pact/theme/components/Button";
import { Fieldset, Input, Label } from "@real-world-pact/theme/components/Form";
import { Text } from "@real-world-pact/theme/components/Text";

import * as Pact from "pact-lang-api";

import { Formik } from "formik";
import { useState } from "react";
import { parsePactDecimal } from "@real-world-pact/utils/pact-code";
import { usePactRequest } from "../pact-api";
import * as keth from "../contracts/keth";
import { syncState, useUserStore } from "../state";
import { Box } from "@real-world-pact/theme/components/Container";
import { Balances, BorrowingCapacity } from "./UserDetails";
import { SUCCESS } from "@real-world-pact/utils/pact-request";
import { ControlledModal, FormRequestButton } from "@real-world-pact/theme/components/Modal";

export interface AccountModalProps {
  [x: string]: unknown;
}

export const AccountModal = ({ ...props }: AccountModalProps) => {
  const [open, setOpen] = useState(false);

  const userStore = useUserStore((state) => ({
    address: state.address,
    keys: state.keys,
    keyset: state.keyset,
  }));

  const [mintStatus, mint] = usePactRequest((amount: Pact.PactDecimal) =>
    keth.mint({
      // Recall that the sender is the gas payer — this isn't a transfer.
      sender: userStore.address,
      senderKeys: userStore.keys,
      receiver: userStore.address,
      receiverGuard: userStore.keyset,
      amount,
    })
  );

  const description = (
    <Text>
      This is your Charkha account. For the dummy application we have given you the 'sender00'
      account that comes with a ton of KDA on devnet. Here, see your current balances. You can also
      "bridge" ETH to KETH.
    </Text>
  );

  const trigger = (
    <Button variant="primary" {...props}>
      Account
    </Button>
  );

  return (
    <ControlledModal
      open={open}
      onOpenChange={setOpen}
      title="Account"
      description={description}
      trigger={trigger}
    >
      <Formik
        initialValues={{ amount: "" }}
        onSubmit={async (values) => {
          const parsed = parsePactDecimal(values.amount) as Pact.PactDecimal;
          const result = await mint(parsed);
          if (result.status === SUCCESS) {
            await syncState();
            setOpen(false);
          }
        }}
        validate={(values) => {
          let errors: { amount?: string } = {};
          if (values.amount === "") errors.amount = "Required.";
          const parsed = parsePactDecimal(values.amount);
          if (typeof parsed === "string") errors.amount = parsed;
          return errors;
        }}
      >
        {(formik) => (
          <form onSubmit={formik.handleSubmit}>
            <Box css={{ marginBottom: "$4" }}>
              <Label>Account</Label>
              <Text>{userStore.address}</Text>
            </Box>
            <BorrowingCapacity />
            <Balances />
            <Fieldset>
              <Label htmlFor="amount">Mint KETH Amount</Label>
              <Input
                id="amount"
                name="amount"
                onChange={formik.handleChange}
                value={formik.values.amount}
              />
              <Text css={{ fontSize: "$xs", color: "$crimson11" }}>{formik.errors.amount}</Text>
            </Fieldset>
            <FormRequestButton
              isValid={formik.isValid && formik.dirty}
              request={mintStatus}
              label="Mint KETH"
              onOpenChange={setOpen}
            />
          </form>
        )}
      </Formik>
    </ControlledModal>
  );
};
