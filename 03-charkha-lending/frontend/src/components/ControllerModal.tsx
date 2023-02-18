import { Button } from "@real-world-pact/theme/components/Button";
import { Fieldset, Input, Label } from "@real-world-pact/theme/components/Form";
import { Link, Text } from "@real-world-pact/theme/components/Text";

import * as Pact from "pact-lang-api";

import { Formik } from "formik";
import { useState } from "react";
import { parsePactDecimal } from "@real-world-pact/utils/pact-code";
import { usePactRequest } from "../pact-api";
import { syncState, useUserStore } from "../state";
import { AssetName } from "../contracts/controller";

import * as controller from "../contracts/controller";
import { Balances, BorrowingCapacity } from "./UserDetails";
import { SUCCESS } from "@real-world-pact/utils/pact-request";
import { ControlledModal, FormRequestButton } from "@real-world-pact/theme/components/Modal";

type Action = "BORROW" | "SUPPLY" | "REPAY" | "REDEEM";

export interface ControllerModalProps {
  action: Action;
  market: AssetName;
  [x: string]: unknown;
}

export const ControllerModal = ({ action, market, ...props }: ControllerModalProps) => {
  const [open, setOpen] = useState(false);

  const userStore = useUserStore((state) => ({
    address: state.address,
    keys: state.keys,
    keyset: state.keyset,
  }));

  const mode = (() => {
    switch (action) {
      case "BORROW":
        return {
          request: (amount: Pact.PactDecimal) =>
            controller.borrow({
              // Recall that the sender is the gas payer — this isn't a transfer.
              account: userStore.address,
              accountKeys: userStore.keys,
              accountKeySet: userStore.keyset,
              market,
              tokens: amount,
            }),
          title: "Borrow",
          action: "borrow from",
        };

      case "SUPPLY":
        return {
          request: (amount: Pact.PactDecimal) =>
            controller.supply({
              account: userStore.address,
              accountKeys: userStore.keys,
              market,
              amount,
            }),
          title: "Supply",
          action: "supply to",
        };

      case "REPAY":
        return {
          request: (amount: Pact.PactDecimal) =>
            controller.repay({
              account: userStore.address,
              accountKeys: userStore.keys,
              market,
              amount,
            }),
          title: "Repay",
          action: "repay in",
        };

      case "REDEEM":
        return {
          request: (tokens: Pact.PactDecimal) =>
            controller.redeem({
              account: userStore.address,
              accountKeys: userStore.keys,
              market,
              tokens,
            }),
          title: "Redeem",
          action: "redeem to",
        };
    }
  })();

  const [requestStatus, request] = usePactRequest(mode.request);

  const description = (
    <Text>
      Below, specify how much you would like to {mode.action} the {market} market.
    </Text>
  );

  const trigger =
    action === "BORROW" ? (
      <Button variant="primary" {...props}>
        {mode.title}
      </Button>
    ) : action === "SUPPLY" ? (
      <Button variant="secondary" outlined {...props}>
        {mode.title}
      </Button>
    ) : (
      <Link {...props}>{mode.title}</Link>
    );

  return (
    <ControlledModal
      open={open}
      onOpenChange={setOpen}
      title={mode.title}
      description={description}
      trigger={trigger}
    >
      <Formik
        initialValues={{ amount: "" }}
        onSubmit={async (values) => {
          const parsed = parsePactDecimal(values.amount) as Pact.PactDecimal;
          const result = await request(parsed);
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
            <BorrowingCapacity />
            <Balances />
            <Fieldset>
              <Label htmlFor="amount">
                {mode.title} {market} Amount
              </Label>
              <Input
                id="amount"
                name="amount"
                onChange={formik.handleChange}
                value={formik.values.amount}
              />
              <Text color="primary" css={{ fontSize: "$xs" }}>
                {formik.errors.amount}
              </Text>
            </Fieldset>
            <FormRequestButton
              request={requestStatus}
              isValid={formik.isValid && formik.dirty}
              label={`${mode.title} ${market}`}
              onOpenChange={setOpen}
            />
          </form>
        )}
      </Formik>
    </ControlledModal>
  );
};
