import React from "react";

import { Box, Container, Flex, Grid } from "@real-world-pact/theme/components/Container";
import { AssetName, assetToToken } from "../contracts/controller";
import { Header, Text } from "@real-world-pact/theme/components/Text";
import { useMarketStore, useOracleStore, useUserStore } from "../state";
import { RequestStatus } from "@real-world-pact/utils/pact-request";
import { Label } from "@real-world-pact/theme/components/Form";
import { MarketState } from "../contracts/controller";
import { ControllerModal } from "../components/ControllerModal";
import { RequestLoader } from "@real-world-pact/theme/components/Request";

const Markets = () => {
  const prices = useOracleStore((state) => state.usdPrices);
  const { markets, supplyInterestRates, borrowInterestRates } = useMarketStore((state) => ({
    markets: state.markets,
    supplyInterestRates: state.supplyInterestRates,
    borrowInterestRates: state.borrowInterestRates,
  }));

  const Market = ({ asset }: { asset: AssetName }) => (
    <MarketCard
      asset={asset}
      price={prices.get(asset) || null}
      market={markets.get(asset) || null}
      supplyRate={supplyInterestRates.get(asset) || null}
      borrowRate={borrowInterestRates.get(asset) || null}
    />
  );

  return (
    <Container size="md">
      <UserCard />
      <Market asset="KDA" />
      <Market asset="KETH" />
      <Market asset="CHRK" />
    </Container>
  );
};

interface MarketCardProps {
  asset: AssetName;
  price: null | RequestStatus<number>;
  market: null | RequestStatus<MarketState>;
  supplyRate: null | RequestStatus<number>;
  borrowRate: null | RequestStatus<number>;
}

const MarketCard = ({ asset, price, market, supplyRate, borrowRate }: MarketCardProps) => {
  const Badge = () => (
    <Box
      as="span"
      css={{
        color: "$crimson1",
        backgroundColor: "$crimson11",
        width: "fit-content",
        borderTopLeftRadius: "8px",
        borderTopRightRadius: "8px",
        padding: "2px $3",
        fontWeight: "bold",
        fontSize: "$sm",
      }}
    >
      <Text>{asset}</Text>
    </Box>
  );

  return (
    <Box
      css={{
        marginBottom: "$6",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Badge />
      <Box
        css={{
          border: "2px solid $mauve12",
          padding: "$6",
        }}
      >
        <Grid
          css={{
            gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
          }}
        >
          <Flex css={{ display: "flex", flexDirection: "column", alignSelf: "center " }}>
            <Label>USD Price</Label>
            <RequestLoader request={price}>
              {(parsed) => <Text>${parsed.toFixed(2)}</Text>}
            </RequestLoader>
          </Flex>
          <Flex css={{ display: "flex", flexDirection: "column", alignSelf: "center " }}>
            <Label>Supply</Label>
            <RequestLoader request={market}>
              {({ totalSupply }) => <Text>{totalSupply.toFixed(2)}</Text>}
            </RequestLoader>
          </Flex>
          <Flex css={{ display: "flex", flexDirection: "column", alignSelf: "center " }}>
            <Label>Supply Interest Rate</Label>
            <RequestLoader request={supplyRate}>
              {(rate) => <Text>{(rate * 100.0).toFixed(2)}%</Text>}
            </RequestLoader>
          </Flex>
          <Flex css={{ display: "flex", flexDirection: "column", alignSelf: "center " }}>
            <Label>Borrows</Label>
            <RequestLoader request={market}>
              {({ totalBorrows }) => <Text>{totalBorrows.toFixed(2)}</Text>}
            </RequestLoader>
          </Flex>
          <Flex css={{ display: "flex", flexDirection: "column", alignSelf: "center " }}>
            <Label>Borrow Interest Rate</Label>
            <RequestLoader request={borrowRate}>
              {(rate) => <Text>{(rate * 100.0).toFixed(2)}%</Text>}
            </RequestLoader>
          </Flex>
        </Grid>
        <Flex css={{ alignItems: "baseline", justifyContent: "flex-end", marginTop: "$6" }}>
          <ControllerModal css={{ marginRight: "$2" }} action="REDEEM" market={asset} />
          <ControllerModal css={{ marginRight: "$2" }} action="REPAY" market={asset} />
          <ControllerModal css={{ marginRight: "$2" }} action="SUPPLY" market={asset} />
          <ControllerModal action="BORROW" market={asset} />
        </Flex>
      </Box>
    </Box>
  );
};

const UserCard = () => {
  const user = useUserStore((state) => ({
    borrows: state.borrows,
    getBorrows: state.getBorrows,
    supply: state.supply,
    getSupply: state.getSupply,
  }));

  const Borrow = ({ asset }: { asset: AssetName }) => (
    <Box>
      <Label>{asset}</Label>
      <RequestLoader request={user.borrows.get(assetToToken(asset)) || null}>
        {(parsed) => <Text>{parsed.toFixed(2)}</Text>}
      </RequestLoader>
    </Box>
  );

  const Supply = ({ asset }: { asset: AssetName }) => (
    <Box>
      <Label>{asset}</Label>
      <RequestLoader request={user.supply.get(assetToToken(asset)) || null}>
        {(parsed) => <Text>{parsed.toFixed(2)}</Text>}
      </RequestLoader>
    </Box>
  );

  return (
    <Grid css={{ gridTemplateColumns: "1fr 1fr", margin: "$6 0" }}>
      <Box css={{ padding: "$6", border: "2px solid $mauve12" }}>
        <Header as="h3">Your Lending</Header>
        <Grid css={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <Supply asset={"KDA"} />
          <Supply asset={"KETH"} />
          <Supply asset={"CHRK"} />
        </Grid>
      </Box>
      <Box css={{ padding: "$6", border: "2px solid $mauve12", borderLeft: "0" }}>
        <Header as="h3">Your Borrowing</Header>
        <Grid css={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <Borrow asset={"KDA"} />
          <Borrow asset={"KETH"} />
          <Borrow asset={"CHRK"} />
        </Grid>
      </Box>
    </Grid>
  );
};

export default Markets;
