import { ErrorIcon, NotStartedIcon } from "@real-world-pact/theme/components/Icon";
import { Spinner } from "@real-world-pact/theme/components/Spinner";
import {
  EXEC_ERROR,
  PENDING,
  RequestStatus,
  REQUEST_ERROR,
} from "@real-world-pact/utils/pact-request";
import { ReactElement } from "react";

export interface RequestLoaderProps<a> {
  request: undefined | RequestStatus<a>;
  success: (result: a) => ReactElement;
}

export function RequestLoader<a>({ request, success }: RequestLoaderProps<a>): ReactElement {
  if (!request) {
    return <NotStartedIcon size="medium" />;
  } else if (request.status === PENDING) {
    return <Spinner size="medium" />;
  } else if (request.status === REQUEST_ERROR || request.status === EXEC_ERROR) {
    return <ErrorIcon size="medium" />;
  } else {
    return success(request.parsed);
  }
}
