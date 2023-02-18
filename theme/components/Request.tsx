import {
  ExecError,
  EXEC_ERROR,
  PENDING,
  RequestStatus,
  REQUEST_ERROR,
  SUCCESS,
} from "@real-world-pact/utils/pact-request";
import { FailureResult } from "pact-lang-api";
import { ReactElement } from "react";
import { Flex } from "./Container";
import { ErrorIcon, NotStartedIcon } from "./Icon";
import { Spinner } from "./Spinner";
import { Text } from "./Text";

export interface RequestLoaderProps<a> {
  request: null | RequestStatus<a>;
  showError?: boolean;
  onExecError?: (error: FailureResult) => a;
  children: (parsed: a) => ReactElement;
}

export function RequestLoader<a>({
  request,
  showError,
  onExecError,
  children,
}: RequestLoaderProps<a>): ReactElement {
  const iconCSS = { marginTop: "1px" };
  if (!request) return <NotStartedIcon size="medium" css={iconCSS} />;
  if (request.status === PENDING) return <Spinner size="medium" css={iconCSS} />;
  if (request.status === SUCCESS) return children(request.parsed);
  if (request.status === EXEC_ERROR && onExecError)
    return children(onExecError(request.response.result));
  if (showError) {
    return (
      <Flex css={{ alignItems: "center" }}>
        <ErrorIcon size="medium" css={{ ...iconCSS, marginRight: "$1" }} />
        <RequestErrorMessage request={request} />
      </Flex>
    );
  } else {
    return <ErrorIcon size="medium" />;
  }
}

export interface RequestErrorProps {
  request: null | RequestStatus<any> | (null | RequestStatus<any>)[];
  [x: string]: unknown;
}

export const RequestErrorMessage = ({
  request,
  ...props
}: RequestErrorProps): null | ReactElement => {
  const ErrorMessage = ({ req }: { req: RequestStatus<any> }): null | ReactElement =>
    req.status === EXEC_ERROR ? (
      <Text color="primary" {...props}>
        Pact execution failed ({req.response.result.error.type}) {req.response.result.error.message}
      </Text>
    ) : req.status === REQUEST_ERROR ? (
      <Text color="primary" {...props}>
        Request to node failed: {req.message}
      </Text>
    ) : null;

  if (!request) {
    return null;
  } else if (!Array.isArray(request)) {
    return <ErrorMessage req={request} />;
  } else {
    const noNulls = request.flatMap((value) => (value ? [value] : []));
    const firstError = noNulls.find(
      (value) => value.status === EXEC_ERROR || value.status === REQUEST_ERROR
    );
    return firstError === undefined ? null : <ErrorMessage req={firstError} />;
  }
};
