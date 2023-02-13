import React from "react";

import { Container } from "@real-world-pact/theme/components/Container";
import { useGovernanceStore } from "../state";

const Governance = () => {
  const { proposals, getProposals } = useGovernanceStore();
  return <Container size="md">{JSON.stringify(proposals)}</Container>;
};

export default Governance;
