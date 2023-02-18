import { Box, Grid } from "@real-world-pact/theme/components/Container";
import { Label } from "@real-world-pact/theme/components/Form";
import { RequestLoader } from "@real-world-pact/theme/components/Request";
import { Text } from "@real-world-pact/theme/components/Text";
import { ReactElement, ReactNode } from "react";
import { AssetName } from "../contracts/controller";
import { useUserStore } from "../state";

export const Balances = (): ReactElement => {
  const balances = useUserStore((state) => state.balances);

  const entries = Array.from(balances.entries()).map(([key, value]) => {
    return (
      <BalancePair key={key} asset={key}>
        <RequestLoader showError={true} onExecError={() => 0.0} request={value}>
          {(parsed) => <Box>{parsed}</Box>}
        </RequestLoader>
      </BalancePair>
    );
  });

  return (
    <Box css={{ marginBottom: "$6" }}>
      <Label>Balances</Label>
      {entries}
    </Box>
  );
};

interface BalancePair {
  asset: AssetName;
  children: ReactNode;
}

export const BalancePair = ({ asset, children }: BalancePair): ReactElement => {
  return (
    <Grid key={asset} css={{ gridTemplateColumns: "$16 1fr", alignItems: "center" }}>
      <Text>{asset}:</Text>
      <Box css={{ alignSelf: "center" }}>{children}</Box>
    </Grid>
  );
};

export const BorrowingCapacity = (): ReactElement => {
  const capacity = useUserStore((state) => state.borrowingCapacity);
  return (
    <Box>
      <Label>Borrowing Capacity (USD)</Label>
      <Box css={{ marginBottom: "$4" }}>
        <RequestLoader showError={true} request={capacity}>
          {(parsed) => <Text>{parsed}</Text>}
        </RequestLoader>
      </Box>
    </Box>
  );
};
