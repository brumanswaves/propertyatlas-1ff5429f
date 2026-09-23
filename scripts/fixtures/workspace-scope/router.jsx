import React from "react";
import { QueryClient } from "@tanstack/react-query";
const client = new QueryClient();
const route = (options) => ({ options, useRouteContext: () => ({ queryClient: client }) });
export const createFileRoute = () => route;
export const createRootRouteWithContext = () => route;
export const Link = ({ children }) => <span>{children}</span>;
export const HeadContent = () => null;
export const Scripts = () => null;
export const useRouter = () => ({ invalidate() {} });
export const Outlet = () =>
  window.fixture.route === "report" ? (
    <h2>Frozen report route placeholder</h2>
  ) : (
    <window.fixture.Map />
  );
