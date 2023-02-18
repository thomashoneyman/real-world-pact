/* ADMIN MODAL

The admin modal lets the user act as the faucet administrator account and raise
their per-request and/or per-account limits. This file is standard React; there
isn't Pact-specific code here except for the requests made to set the limits.

*/

import { useState } from "react";
import { Formik } from "formik";

import { Fieldset, Input, Label } from "@real-world-pact/theme/components/Form";
import { Link, Text } from "@real-world-pact/theme/components/Text";

import { parsePactDecimal } from "@real-world-pact/utils/pact-code";
import { userAccount } from "../accounts";
import * as faucet from "../contracts/goliath-faucet";
import { usePactRequest } from "../pact-api";
import { FormRequestButton, ControlledModal } from "@real-world-pact/theme/components/Modal";

interface AdminModalProps {
  onSuccess: () => Promise<void>;
  [x: string]: unknown;
}

// The admin modal lets you change the current per-request or per-account limits
// for the user account. Most of this code is typical React code, so I've left
// out the comments. However, you can see another use of 'useRequest' below.
export const AdminModal = ({ onSuccess, ...props }: AdminModalProps) => {
  const [open, setOpen] = useState(false);

  const [setRequestLimit, runSetRequestLimit] = usePactRequest(faucet.setRequestLimit);
  const [setAccountLimit, runSetAccountLimit] = usePactRequest(faucet.setAccountLimit);

  const title = "Faucet Contract Admin";

  const description = (
    <Text>
      The faucet smart contract has controls that allow the faucet account to raise or lower the
      per-account and per-request limits. You can act as the faucet account and change those limits.
    </Text>
  );

  return (
    <ControlledModal
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      trigger={<Link {...props}>Admin</Link>}
    >
      <Formik
        initialValues={{ requestLimit: "", accountLimit: "" }}
        onSubmit={async (fields) => {
          const account = userAccount.address;
          const requestLimit = parsePactDecimal(fields.requestLimit);
          const accountLimit = parsePactDecimal(fields.accountLimit);
          if (typeof requestLimit !== "string" && typeof accountLimit !== "string") {
            await Promise.all([
              runSetRequestLimit({ account, amount: requestLimit }),
              runSetAccountLimit({ account, amount: accountLimit }),
            ]);
          } else if (typeof requestLimit !== "string") {
            await runSetRequestLimit({ account, amount: requestLimit });
          } else if (typeof accountLimit !== "string") {
            await runSetAccountLimit({ account, amount: accountLimit });
          }
          await onSuccess();
        }}
        validate={(values) => {
          const errors: { requestLimit?: string; accountLimit?: string } = {};
          const requestError = validateRequestLimit(
            values.requestLimit,
            faucet.DEFAULT_REQUEST_LIMIT
          );
          const accountError = validateRequestLimit(
            values.accountLimit,
            faucet.DEFAULT_ACCOUNT_LIMIT
          );
          if (requestError !== null) errors.requestLimit = requestError;
          if (accountError !== null) errors.accountLimit = accountError;
          if (values.requestLimit === "" && values.accountLimit === "")
            errors.requestLimit = "At least one field is required.";
          return errors;
        }}
      >
        {(formik) => (
          <form onSubmit={formik.handleSubmit}>
            <Fieldset>
              <Label htmlFor="requestLimit">New Request Limit</Label>
              <Input
                id="requestLimit"
                name="requestLimit"
                onChange={formik.handleChange}
                value={formik.values.requestLimit}
              />
              {formik.errors.requestLimit && (
                <Text css={{ fontSize: "$xs", color: "$crimson11" }}>
                  {formik.errors.requestLimit}
                </Text>
              )}
            </Fieldset>
            <Fieldset>
              <Label htmlFor="accountLimit">New Account Limit</Label>
              <Input
                id="accountLimit"
                name="accountLimit"
                onChange={formik.handleChange}
                value={formik.values.accountLimit}
              />
              {formik.errors.accountLimit && (
                <Text css={{ fontSize: "$xs", color: "$crimson11" }}>
                  {formik.errors.accountLimit}
                </Text>
              )}
            </Fieldset>
            <FormRequestButton
              request={[setRequestLimit, setAccountLimit]}
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

const validateRequestLimit = (value: string, min: number): null | string => {
  const parsed = parsePactDecimal(value);
  if (value === "") return null;
  if (typeof parsed === "string") {
    return parsed;
  } else if (parseFloat(parsed.decimal) < min) {
    return `Must be greater than existing limit (${min}).`;
  }
  return null;
};
