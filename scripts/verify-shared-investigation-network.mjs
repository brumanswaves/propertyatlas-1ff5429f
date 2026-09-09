// Test-only runtime boundary. Never imported by the production application.
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";

const allowed = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
function check(host) {
  if (!allowed.has(String(host ?? "localhost"))) throw new Error("Isolated test blocked external service traffic");
}
const fetchImpl = globalThis.fetch;
globalThis.fetch = (input, init) => {
  check(new URL(input instanceof Request ? input.url : input).hostname);
  return fetchImpl(input, init);
};
for (const module of [net, tls]) {
  const connect = module.connect;
  module.connect = function (...args) {
    const options = args[0];
    check(typeof options === "object" ? options.host : typeof args[1] === "string" ? args[1] : "localhost");
    return connect.apply(this, args);
  };
}
for (const module of [http, https]) {
  const request = module.request;
  module.request = function (...args) {
    const options = args[0];
    check(typeof options === "string" || options instanceof URL ? new URL(options).hostname : options.hostname ?? options.host);
    return request.apply(this, args);
  };
}
syncBuiltinESMExports();
