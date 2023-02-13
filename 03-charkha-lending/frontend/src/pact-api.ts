import { NetworkId } from "pact-lang-api";
import {
  EXEC_ERROR,
  HostName,
  PactAPI,
  PENDING,
  RequestStatus,
  REQUEST_ERROR,
} from "@real-world-pact/utils/pact-request";
import { makeUsePactRequest } from "@real-world-pact/utils/pact-request-hooks";
import { ModalRequestStatus } from "@real-world-pact/theme/components/Modal/FormModal";

const networkId: NetworkId = "development";
const hostname: HostName = "localhost:8080";
const chainId: string = "0";

// This new 'pactAPI' is configured with our defaults and can be used to execute
// 'local' (read-only) and 'send' (modifies the blockchain) requests.
export const pactAPI = new PactAPI({ networkId, hostname, chainId });
export const usePactRequest = makeUsePactRequest(pactAPI);

// Convert a Pact request status into a Modal request status. A convenience
// function to help unify errors in the modal and excit on success.
export const toModalRequestStatus = (request: null | RequestStatus<any>): ModalRequestStatus => {
  if (!request) {
    return { status: "NOT_SENT" };
  } else if (request.status === PENDING) {
    return { status: "PENDING" };
  } else if (request.status === REQUEST_ERROR) {
    return { status: "ERROR", message: request.message };
  } else if (request.status === EXEC_ERROR) {
    return {
      status: "ERROR",
      message: request.response.result.error.type + " " + request.response.result.error.message,
    };
  } else {
    return { status: "SUCCESS" };
  }
};
