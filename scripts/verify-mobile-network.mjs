// Test-only runtime boundary. Never imported by the production application.
import { appendFileSync } from "node:fs";
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";

const allowed = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
function check(host) {
  if (!allowed.has(String(host ?? "localhost"))) {
    if (process.env.EASY_ERF_EGRESS_LOG)
      appendFileSync(
        process.env.EASY_ERF_EGRESS_LOG,
        JSON.stringify({ blocked: String(host), pid: process.pid }) + "\n",
      );
    throw new Error("Isolated mobile test blocked external service traffic");
  }
}
function checkSocket(args) {
  const values = Array.isArray(args[0]) ? args[0] : args;
  const options = values[0];
  check(
    typeof options === "object"
      ? options.host
      : typeof values[1] === "string"
        ? values[1]
        : "localhost",
  );
}
const socketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  checkSocket(args);
  return socketConnect.apply(this, args);
};
const fetchImpl = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
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
    check(
      typeof options === "string" || options instanceof URL
        ? new URL(options).hostname
        : (options.hostname ?? options.host),
    );
    return request.apply(this, args);
  };
}
// get() has its own original request closure, so guard it independently.
for (const module of [http, https]) {
  const get = module.get;
  module.get = function (...args) {
    const options = args[0];
    check(
      typeof options === "string" || options instanceof URL
        ? new URL(options).hostname
        : (options.hostname ?? options.host),
    );
    return get.apply(this, args);
  };
}
syncBuiltinESMExports();
