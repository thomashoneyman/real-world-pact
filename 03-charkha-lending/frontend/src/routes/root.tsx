import React from "react";

import { Box, Flex } from "@real-world-pact/theme/components/Container";
import { GlobalStyles } from "@real-world-pact/theme/components/GlobalStyles";
import { CharkhaLogo, Navbar } from "@real-world-pact/theme/components/Navbar";
import { RouteLink } from "../components/RouteLink";
import { Outlet } from "react-router-dom";
import { AccountModal } from "../components/AccountModal";
import Loader from "./loader";

const Root = () => {
  const CenterNav = () => (
    <Flex>
      <RouteLink to="/markets" css={{ marginRight: "$2" }}>
        Markets
      </RouteLink>
      <RouteLink to="/governance">Governance</RouteLink>
    </Flex>
  );

  return (
    <GlobalStyles>
      <Box css={{ padding: "0 $1" }}>
        <Navbar logo={<CharkhaLogo />} center={<CenterNav />}>
          <Flex css={{ alignItems: "center" }}>
            <AccountModal />
          </Flex>
        </Navbar>
        <Loader>
          <Outlet />
        </Loader>
      </Box>
    </GlobalStyles>
  );
};

export default Root;
