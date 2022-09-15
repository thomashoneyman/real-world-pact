/* REQUEST FUNDS MODAL

The 'request funds' modal lets the user request funds from the faucet contract.
This modal is a simple form that lets the user provide a KDA amount and simply
calls back to the App.tsx module to make the request.

This file isn't commented because this is standard React code.

*/

import { Button } from "@real-world-pact/theme/components/Button";
import { Fieldset, Input, Label } from "@real-world-pact/theme/components/Form";
import { FormModal } from "@real-world-pact/theme/components/Modal/FormModal";
import { Text } from "@real-world-pact/theme/components/Text";

import * as Pact from "pact-lang-api";

import { Formik } from "formik";
import { ReactNode } from "react";
import { parsePactDecimal } from "../pact-utils/pact-code";

export interface RequestFundsModalProps {
  onSubmit: (amount: Pact.PactDecimal) => any;
  [x: string]: any;
}

export const RequestFundsModal = ({ onSubmit, ...props }: RequestFundsModalProps) => {
  const description = (
    <Text>
      Other Kadena addresses can send their KDA to you. You simply need to share your account
      address with them (your k: account). However, we've built a smart contract that you can ask to
      send you funds. This smart contract limits how much KDA it will send you per request and the
      total KDA it will send to any account. However, you can change these limits using the Admin
      section in the navbar. If you reach your limit, try raising it using the 'Admin' modal!
    </Text>
  );

  const trigger = (
    <Button variant="secondary" outlined {...props}>
      Request KDA
    </Button>
  );

  const renderForm = (renderActions: (isValid: boolean) => ReactNode) => (
    <Formik
      initialValues={{ amount: "" }}
      onSubmit={(values) => {
        const parsed = parsePactDecimal(values.amount) as Pact.PactDecimal;
        onSubmit(parsed);
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
          <Fieldset>
            <Label htmlFor="amount">Request Amount</Label>
            <Input
              id="amount"
              name="amount"
              onChange={formik.handleChange}
              value={formik.values.amount}
            />
            <Text css={{ fontSize: "$xs", color: "$crimson11" }}>{formik.errors.amount}</Text>
            {renderActions(formik.isValid && formik.dirty)}
          </Fieldset>
        </form>
      )}
    </Formik>
  );

  return (
    <FormModal
      title="Receive KDA"
      description={description}
      trigger={trigger}
      confirmLabel="Send Transaction"
      renderForm={renderForm}
    ></FormModal>
  );
};
