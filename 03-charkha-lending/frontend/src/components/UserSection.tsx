import { Box, Grid } from "@real-world-pact/theme/components/Container";
import { Label } from "@real-world-pact/theme/components/Form";
import { NotStartedIcon } from "@real-world-pact/theme/components/Icon";
import { Spinner } from "@real-world-pact/theme/components/Spinner";
import { Text } from "@real-world-pact/theme/components/Text";
import { EXEC_ERROR, PENDING, REQUEST_ERROR, SUCCESS } from "@real-world-pact/utils/pact-request";
import { ReactElement, ReactNode, useEffect } from "react";
import { AssetName } from "../contracts/controller";
import { useUserStore } from "../state";

export const Balances = (): ReactElement => {
  const userStore = useUserStore((state) => ({
    balances: state.balances,
    getBalances: state.getBalances,
  }));

  useEffect(() => {
    (async () => await userStore.getBalances())();
  }, []);

  const entries = Array.from(userStore.balances.entries()).map(([key, value]) => {
    switch (value.status) {
      case PENDING:
        return (
          <BalancePair key={key} asset={key}>
            <Spinner size="medium" />
          </BalancePair>
        );

      case REQUEST_ERROR:
        return (
          <BalancePair key={key} asset={key}>
            <Text css={{ color: "$crimson11", fontSize: "$sm" }}>{value.message}</Text>
          </BalancePair>
        );

      case EXEC_ERROR:
        return (
          <BalancePair key={key} asset={key}>
            0.0
          </BalancePair>
        );

      case SUCCESS:
        return (
          <BalancePair key={key} asset={key}>
            {value.parsed}
          </BalancePair>
        );
    }
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
    <Grid key={asset} css={{ gridTemplateColumns: "$16 1fr" }}>
      <Text>{asset}:</Text>
      <Text>{children}</Text>
    </Grid>
  );
};

export const BorrowingCapacity = (): ReactElement => {
  const capacity = useUserStore((state) => state.borrowingCapacity);

  const CurrentCapacity = () => {
    if (!capacity) return <NotStartedIcon size="medium" />;
    switch (capacity.status) {
      case PENDING:
        return <Spinner size="medium" />;
      case REQUEST_ERROR:
        return <Text css={{ color: "$crimson11" }}>{capacity.message}</Text>;
      case EXEC_ERROR:
        return (
          <Text css={{ color: "$crimson11" }}>
            {capacity.response.result.error.type + " " + capacity.response.result.error.message}
          </Text>
        );
      case SUCCESS:
        return <Text>{capacity.parsed}</Text>;
    }
  };

  return (
    <>
      <Label>Borrowing Capacity (USD)</Label>
      <Box css={{ marginBottom: "$4" }}>
        <CurrentCapacity />
      </Box>
    </>
  );
};
