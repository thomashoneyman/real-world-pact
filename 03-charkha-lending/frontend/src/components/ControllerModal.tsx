import { Button } from "@real-world-pact/theme/components/Button";
import { Fieldset, Input, Label } from "@real-world-pact/theme/components/Form";
import { FormRequestModal } from "@real-world-pact/theme/components/Modal/FormModal";
import { Link, Text } from "@real-world-pact/theme/components/Text";

import * as Pact from "pact-lang-api";

import { Formik } from "formik";
import { ReactNode } from "react";
import { parsePactDecimal } from "@real-world-pact/utils/pact-code";
import { toModalRequestStatus, usePactRequest } from "../pact-api";
import { syncState, useUserStore } from "../state";
import { AssetName } from "../contracts/controller";

import * as controller from "../contracts/controller";
import { Balances, BorrowingCapacity } from "./UserSection";
import { SUCCESS } from "@real-world-pact/utils/pact-request";

type Action = "BORROW" | "SUPPLY" | "REPAY" | "REDEEM";

export interface ControllerModalProps {
  action: Action;
  market: AssetName;
  [x: string]: any;
}

export const ControllerModal = ({ action, market, ...props }: ControllerModalProps) => {
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
      <Button variant="secondary" {...props}>
        {mode.title}
      </Button>
    ) : (
      <Link {...props}>{mode.title}</Link>
    );

  const renderForm = (renderError: ReactNode, renderActions: (isValid: boolean) => ReactNode) => (
    <Formik
      initialValues={{ amount: "" }}
      onSubmit={async (values) => {
        const parsed = parsePactDecimal(values.amount) as Pact.PactDecimal;
        const result = await request(parsed);
        if (result.status === SUCCESS) {
          await syncState();
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
            <Label htmlFor="amount">Borrow {market} Amount</Label>
            <Input
              id="amount"
              name="amount"
              onChange={formik.handleChange}
              value={formik.values.amount}
            />
            <Text css={{ fontSize: "$xs", color: "$crimson11" }}>{formik.errors.amount}</Text>
          </Fieldset>
          {renderError}
          {renderActions(formik.isValid && formik.dirty)}
        </form>
      )}
    </Formik>
  );

  return (
    <FormRequestModal
      title={mode.title}
      description={description}
      trigger={trigger}
      confirmLabel={`${mode.title} ${market}`}
      request={toModalRequestStatus(requestStatus)}
      renderForm={renderForm}
    ></FormRequestModal>
  );
};
