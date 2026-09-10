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
function checkSocket(args) {
  const values = Array.isArray(args[0]) ? args[0] : args;
  const options = values[0];
  check(typeof options === "object" ? options.host : typeof values[1] === "string" ? values[1] : "localhost");
}
const socketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  checkSocket(args);
  return socketConnect.apply(this, args);
};
const fetchImpl = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  // Fixed synthetic public-source response, never a passthrough or saved-data
  // assertion. The production collector still validates identity and provenance.
  if (url.origin + url.pathname === "https://csggis.drdlr.gov.za/server/rest/services/CSGSearch/MapServer/2/query"
    && url.searchParams.get("where") === "ID='C00000000000004200000'") {
    return Promise.resolve(Response.json({ features: [{ attributes: {
      ID: "C00000000000004200000", PARCEL_NO: "42", PORTION: 0, GEOM_AREA: 600,
      MUNICIPALITY: "Kouga Local Municipality", PROVINCE: "Eastern Cape",
    } }] }));
  }
  check(url.hostname);
  return fetchImpl(input, init);
};
for (const module of [net, tls]) {
  const connect = module.connect;
  module.connect = function (...args) {
    checkSocket(args);
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
// get() has its own original request closure, so guard it independently.
for (const module of [http, https]) {
  const get = module.get;
  module.get = function (...args) {
    const options = args[0];
    check(typeof options === "string" || options instanceof URL ? new URL(options).hostname : options.hostname ?? options.host);
    return get.apply(this, args);
  };
}
syncBuiltinESMExports();
