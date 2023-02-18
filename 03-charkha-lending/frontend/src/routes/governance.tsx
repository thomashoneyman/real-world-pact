import React from "react";

import { Box, Container, Flex, Grid } from "@real-world-pact/theme/components/Container";
import { syncState, useGovernanceStore, useUserStore } from "../state";
import { Proposal } from "../contracts/governance";
import * as chrk from "../contracts/chrk";
import { CreateProposalModal } from "../components/CreateProposalModal";
import { Header, Link, Text } from "@real-world-pact/theme/components/Text";
import { usePactRequest } from "../pact-api";
import { Button } from "@real-world-pact/theme/components/Button";
import { Spinner } from "@real-world-pact/theme/components/Spinner";
import { EXEC_ERROR, PENDING, RequestStatus, SUCCESS } from "@real-world-pact/utils/pact-request";
import { Label } from "@real-world-pact/theme/components/Form";

import * as governance from "../contracts/governance";
import { RequestErrorMessage, RequestLoader } from "@real-world-pact/theme/components/Request";

const Governance = () => {
  const proposals = useGovernanceStore((state) => state.proposals);
  const entries = Array.from(proposals.entries());

  return (
    <Container size="md" css={{ paddingBottom: "$6" }}>
      <Flex css={{ justifyContent: "space-between", marginTop: "$6" }}>
        <Header>Proposals</Header>
        <CreateProposalModal />
      </Flex>
      <Grid css={{ gridTemplateColumns: "3fr 1fr" }}>
        <Box>
          {proposals.size === 0 ? (
            <Text>No proposals yet created.</Text>
          ) : (
            <Box>
              {entries.reverse().map(([id, proposal]) => (
                <ProposalCard key={id} id={id} proposal={proposal} />
              ))}
            </Box>
          )}
        </Box>
        <ClaimCard />
      </Grid>
    </Container>
  );
};

const ClaimCard = () => {
  const user = useUserStore();

  const [claimStatus, claim] = usePactRequest(() =>
    chrk.claimCreate({
      account: user.address,
      accountKeys: user.keys,
      accountGuard: user.keyset,
    })
  );

  const chrkBalance = user.balances.get("CHRK");

  const ShowBalance = () => {
    if (chrkBalance?.status === PENDING) {
      return <Spinner size="medium" />;
    } else if (chrkBalance?.status === SUCCESS) {
      return <Text>{chrkBalance.parsed}</Text>;
    } else if (chrkBalance?.status === EXEC_ERROR) {
      return <Text>{chrkBalance.response.result.error.message}</Text>;
    } else {
      return <Text>0.0</Text>;
    }
  };

  return (
    <Box
      css={{
        border: "2px solid $mauve12",
        marginLeft: "$2",
        marginTop: "$6",
        padding: "$2 0 $4 0",
        textAlign: "center",
        alignSelf: "flex-start",
      }}
    >
      <Box>
        <Label>CHRK Balance</Label>
        <ShowBalance />
      </Box>
      <Link
        css={{ marginTop: "$4" }}
        onClick={async () => {
          if (claimStatus?.status !== PENDING) {
            const result = await claim({});
            if (result.status === SUCCESS) {
              await user.getBalances();
            }
          }
        }}
      >
        {claimStatus?.status === PENDING ? <Spinner /> : <Text>Claim CHRK</Text>}
      </Link>
    </Box>
  );
};

interface ProposalCardProps {
  id: string;
  proposal: RequestStatus<Proposal>;
}
const ProposalCard = (props: ProposalCardProps) => {
  const [closeStatus, closeVote] = usePactRequest(governance.closeProposal);

  return (
    <Box css={{ padding: "$6", marginTop: "$6", border: "2px solid $mauve12" }}>
      <Header as="h3">{props.id}</Header>
      <RequestLoader request={props.proposal}>{({ name }) => <Text>{name}</Text>}</RequestLoader>
      <Grid css={{ marginTop: "$2", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
        <Box>
          <Label>Market</Label>
          <RequestLoader request={props.proposal}>
            {({ market }) => <Text>{market}</Text>}
          </RequestLoader>
        </Box>
        <Box>
          <Label>Status</Label>
          <RequestLoader request={props.proposal}>
            {({ status }) => <Text>{status}</Text>}
          </RequestLoader>
        </Box>
        <Box>
          <Label>Market Factor</Label>
          <RequestLoader request={props.proposal}>
            {({ proposalFactor }) => <Text>{proposalFactor}</Text>}
          </RequestLoader>
        </Box>
        <Box>
          <Label>Proposed Value</Label>
          <RequestLoader request={props.proposal}>
            {({ proposalValue }) => <Text>{proposalValue}</Text>}
          </RequestLoader>
        </Box>
      </Grid>
      <Header as="h4" css={{ marginTop: "$6" }}>
        Votes
      </Header>
      <Grid css={{ marginTop: "$2", gridTemplateColumns: "1fr 1fr" }}>
        <Box>
          <Label>For</Label>
          <RequestLoader request={props.proposal}>
            {(proposal) => <Text>{proposal.for.join(", ")}</Text>}
          </RequestLoader>
        </Box>
        <Box>
          <Label>Against</Label>
          <RequestLoader request={props.proposal}>
            {(proposal) => <Text>{proposal.against.join(", ")}</Text>}
          </RequestLoader>
        </Box>
      </Grid>
      <Flex css={{ marginTop: "$6", alignItems: "center", justifyContent: "space-between" }}>
        <RequestErrorMessage request={closeStatus} />
        <Text></Text>
        {props.proposal.status === SUCCESS && props.proposal.parsed.status !== "OPEN" ? null : (
          <Button
            variant="secondary"
            outlined
            disabled={closeStatus?.status === PENDING}
            onClick={async () => {
              const result = await closeVote(props.id);
              if (result.status === SUCCESS) {
                await syncState();
              }
            }}
          >
            {closeStatus?.status === PENDING ? <Spinner /> : <Text>Close Voting</Text>}
          </Button>
        )}
      </Flex>
    </Box>
  );
};

export default Governance;
