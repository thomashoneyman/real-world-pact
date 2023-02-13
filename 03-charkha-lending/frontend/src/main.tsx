import React from "react";
import ReactDOM from "react-dom/client";

import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import Governance from "./routes/governance";
import Markets from "./routes/markets";
import Root from "./routes/root";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      {
        index: true,
        element: <Navigate to="/markets" />,
      },
      {
        path: "/markets",
        element: <Markets />,
      },
      {
        path: "/governance",
        element: <Governance />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
