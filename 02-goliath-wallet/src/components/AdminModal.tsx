/* ADMIN MODAL

The admin modal lets the user act as the faucet administrator account and raise
their per-request and/or per-account limits. This file is standard React; there
isn't Pact-specific code here except for the requests made to set the limits.

*/

import { ReactNode } from "react";
import { Formik } from "formik";

import { Fieldset, Input, Label } from "@real-world-pact/theme/components/Form";
import * as FormModal from "@real-world-pact/theme/components/Modal/FormModal";
import { Link, Text } from "@real-world-pact/theme/components/Text";

import { parsePactDecimal } from "@real-world-pact/utils/pact-code";
import {
  EXEC_ERROR,
  PENDING,
  RequestStatus,
  REQUEST_ERROR,
} from "@real-world-pact/utils/pact-request";

import { userAccount } from "../accounts";
import * as faucet from "../contracts/goliath-faucet";
import { usePactRequest } from "../pact-api";

interface AdminModalProps {
  onSuccess: () => Promise<void>;
  [x: string]: any;
}

// The admin modal lets you change the current per-request or per-account limits
// for the user account. Most of this code is typical React code, so I've left
// out the comments. However, you can see another use of 'useRequest' below.
export const AdminModal = ({ onSuccess, ...props }: AdminModalProps) => {
  const [setRequestLimit, runSetRequestLimit] = usePactRequest(faucet.setRequestLimit);
  const [setAccountLimit, runSetAccountLimit] = usePactRequest(faucet.setAccountLimit);

  const validateLimit = (value: string, min: number): null | string => {
    const parsed = parsePactDecimal(value);
    if (value === "") return null;
    if (typeof parsed === "string") {
      return parsed;
    } else if (parseFloat(parsed.decimal) < min) {
      return `Must be greater than existing limit (${min}).`;
    }
    return null;
  };

  const renderForm = (renderError: ReactNode, renderActions: (isValid: boolean) => ReactNode) => (
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
        const requestError = validateLimit(values.requestLimit, faucet.DEFAULT_REQUEST_LIMIT);
        const accountError = validateLimit(values.accountLimit, faucet.DEFAULT_ACCOUNT_LIMIT);
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
          {renderError}
          {renderActions(formik.isValid && formik.dirty)}
        </form>
      )}
    </Formik>
  );

  return (
    <FormModal.FormRequestModal
      title="Faucet Contract Admin"
      description={
        <Text>
          The faucet smart contract has controls that allow the faucet account to raise or lower the
          per-account and per-request limits. You can act as the faucet account and change those
          limits.
        </Text>
      }
      trigger={<Link {...props}>Admin</Link>}
      confirmLabel="Send Transaction"
      request={FormModal.mergeStatuses(
        toModalRequestStatus(setRequestLimit),
        toModalRequestStatus(setAccountLimit)
      )}
      renderForm={renderForm}
    ></FormModal.FormRequestModal>
  );
};

// Convert a Pact request status into a Modal request status. A convenience
// function to help unify errors in the modal and excit on success.
const toModalRequestStatus = (request: null | RequestStatus<any>): FormModal.ModalRequestStatus => {
  if (!request) return { status: "NOT_SENT" };
  if (request.status === PENDING) return { status: "PENDING" };
  if (request.status === REQUEST_ERROR) return { status: "ERROR", message: request.message };
  if (request.status === EXEC_ERROR)
    return { status: "ERROR", message: request.response.result.error.message };
  return { status: "SUCCESS" };
};
