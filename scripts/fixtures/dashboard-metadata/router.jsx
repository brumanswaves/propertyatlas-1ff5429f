import React from "react";
export const createFileRoute = () => (options) => ({ options });
export const Link = ({ to, children, ...props }) => (
  <a href={to} {...props}>
    {children}
  </a>
);
const navigate = (options) => {
  window.fixture.redirect = options;
};
export const useNavigate = () => navigate;
