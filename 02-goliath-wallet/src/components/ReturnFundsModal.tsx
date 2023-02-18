/* RETURN FUNDS MODAL

The 'request funds' modal lets the user request funds from the faucet contract.
This modal is a simple form that lets the user provide a KDA amount and simply
calls back to the App.tsx module to make the request.

This file isn't commented because this is standard React code.

*/

import { Button } from "@real-world-pact/theme/components/Button";
import { Fieldset, Input, Label } from "@real-world-pact/theme/components/Form";
import { Text } from "@real-world-pact/theme/components/Text";

import * as Pact from "pact-lang-api";

import { Formik } from "formik";
import { ReactNode, useState } from "react";
import { parsePactDecimal } from "@real-world-pact/utils/pact-code";
import { ControlledModal, FormSubmitButton, Modal } from "@real-world-pact/theme/components/Modal";

export interface ReturnFundsModalProps {
  onSubmit: (amount: Pact.PactDecimal) => any;
  [x: string]: unknown;
}

export const ReturnFundsModal = ({ onSubmit, ...props }: ReturnFundsModalProps) => {
  const [open, setOpen] = useState(false);

  const title = "Return KDA";

  const description = (
    <Text>
      You can send KDA to other Kadena addresses. You simply need to know the address of their
      account (their k: account). However, since this is a development environment, we've built a
      smart contract you can return funds to. You can only send up to the amount you have received
      from the faucet (ie. your current balance).
    </Text>
  );

  const trigger = (
    <Button variant="primary" {...props}>
      Send KDA
    </Button>
  );

  return (
    <ControlledModal
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      trigger={trigger}
    >
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
              <Label htmlFor="amount">Return Amount</Label>
              <Input
                id="amount"
                name="amount"
                onChange={formik.handleChange}
                value={formik.values.amount}
              />
              <Text css={{ fontSize: "$xs", color: "$crimson11" }}>{formik.errors.amount}</Text>
            </Fieldset>
            <FormSubmitButton
              isValid={formik.isValid && formik.dirty}
              label="Submit Transaction"
              onOpenChange={setOpen}
            />
          </form>
        )}
      </Formik>
    </ControlledModal>
  );
};
