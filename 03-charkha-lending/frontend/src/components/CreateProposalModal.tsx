import { Button } from "@real-world-pact/theme/components/Button";
import { Fieldset, Input, Label } from "@real-world-pact/theme/components/Form";
import { Text } from "@real-world-pact/theme/components/Text";

import * as Pact from "pact-lang-api";

import { Formik } from "formik";
import { useState } from "react";
import { parsePactDecimal } from "@real-world-pact/utils/pact-code";
import { usePactRequest } from "../pact-api";
import { syncState, useUserStore } from "../state";
import { Box } from "@real-world-pact/theme/components/Container";
import { SUCCESS } from "@real-world-pact/utils/pact-request";

import * as governance from "../contracts/governance";
import { AssetName } from "../contracts/controller";
import { ControlledModal, FormRequestButton } from "@real-world-pact/theme/components/Modal";

export interface CreateProposalModalProps {
  [x: string]: unknown;
}

export const CreateProposalModal = ({ ...props }: CreateProposalModalProps) => {
  const [open, setOpen] = useState(false);
  const user = useUserStore((state) => ({ address: state.address, keys: state.keys }));

  const [createStatus, create] = usePactRequest(governance.submitProposal);

  const description = (
    <Text>
      This form allows you to submit a new proposal, once your account has a non-zero CHRK balance.
      You earn CHRK rewards when you have supplied or borrowed funds in a market for at least one
      block. If you submit a proposal with no CHRK you will see "row not found: {user.address}".
    </Text>
  );

  const trigger = (
    <Button variant="secondary" outlined {...props}>
      Create Proposal
    </Button>
  );

  return (
    <ControlledModal
      open={open}
      onOpenChange={setOpen}
      title="New Proposal"
      description={description}
      trigger={trigger}
    >
      <Formik
        initialValues={{ name: "", market: "", factor: "", newValue: "" }}
        onSubmit={async (values) => {
          const newValue = parsePactDecimal(values.newValue) as Pact.PactDecimal;
          const market = values.market as AssetName;
          const factor = values.factor as governance.ProposalFactor;
          const result = await create({
            account: user.address,
            accountKeys: user.keys,
            name: values.name,
            market,
            factor,
            newValue,
          });
          if (result.status === SUCCESS) {
            await syncState();
            setOpen(false);
          }
        }}
        validate={(values) => {
          let errors: { name?: string; market?: string; factor?: string; newValue?: string } = {};
          if (values.name === "") {
            errors.name = "Required.";
          }
          const markets = ["KDA", "KETH", "CHRK"];
          if (markets.findIndex((x) => x === values.market) === -1) {
            errors.market = `Must be one of: ${markets.join(", ")}.`;
          }
          const factors = ["base-rate", "multiplier", "reserve-factor", "collateral-ratio"];
          if (factors.findIndex((x) => x === values.factor) === -1) {
            errors.factor = `Must be one of: ${factors.join(", ")}.`;
          }
          const parsedValue = parsePactDecimal(values.newValue);
          if (typeof parsedValue === "string") {
            errors.newValue = parsedValue;
          } else {
            const num = parseFloat(parsedValue.decimal);
            if (num < 0.0 || num > 1.0) {
              errors.newValue = "Must be between 0.0 and 1.0.";
            }
          }
          return errors;
        }}
      >
        {(formik) => (
          <form onSubmit={formik.handleSubmit}>
            <Box css={{ marginBottom: "$4" }}>
              <Label>Account</Label>
              <Text>{user.address}</Text>
            </Box>
            <Fieldset>
              <Label htmlFor="name">Proposal Name</Label>
              <Input
                id="name"
                name="name"
                onChange={formik.handleChange}
                value={formik.values.name}
              />
              <Text css={{ fontSize: "$xs", color: "$crimson11" }}>
                {formik.values.name && formik.errors.name}
              </Text>
            </Fieldset>
            <Fieldset>
              <Label htmlFor="market">Target Market</Label>
              <Input
                id="market"
                name="market"
                onChange={formik.handleChange}
                value={formik.values.market}
              />
              <Text css={{ fontSize: "$xs", color: "$crimson11" }}>
                {formik.values.market && formik.errors.market}
              </Text>
            </Fieldset>
            <Fieldset>
              <Label htmlFor="factor">Proposal Factor</Label>
              <Input
                id="factor"
                name="factor"
                onChange={formik.handleChange}
                value={formik.values.factor}
              />
              <Text css={{ fontSize: "$xs", color: "$crimson11" }}>
                {formik.values.factor && formik.errors.factor}
              </Text>
            </Fieldset>
            <Fieldset>
              <Label htmlFor="newValue">New Factor Value</Label>
              <Input
                id="newValue"
                name="newValue"
                onChange={formik.handleChange}
                value={formik.values.newValue}
              />
              <Text css={{ fontSize: "$xs", color: "$crimson11" }}>
                {formik.values.newValue && formik.errors.newValue}
              </Text>
            </Fieldset>
            <FormRequestButton
              request={createStatus}
              isValid={formik.isValid && formik.dirty}
              label="Submit Proposal"
              onOpenChange={setOpen}
            />
          </form>
        )}
      </Formik>
    </ControlledModal>
  );
};
