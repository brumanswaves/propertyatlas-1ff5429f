# E1: original configured-build guard reconciliation

Review 5387488393, reviewed candidate 3a493304cae98b8d3cceb59183dfab5b11539400.

The retained artifacts/issue201/network-deny.mjs was hashed without alteration. Its 1,412 bytes produce SHA256 **3e6df94c738a1600e5cb65e510aa8a9d0ccc9e3662b7a3fe2a0e66e1233ca790**, exactly matching networkGuardSha256 in the original configured-build receipt.

The published network-deny.mjs is 1,410 bytes, SHA256 **33785e16232f779891a361f62d31d221403ef87c3aba9da1a71b8b96f0a12039**. Byte comparison establishes the entire original is precisely the published file followed by hexadecimal **0d0a**. The original has 24 LF-terminated code lines and one final CRLF blank line. This mixed-ending suffix was removed by the evidence-packaging operation that split lines, trimmed trailing whitespace, joined with LF, trimmed the end and appended one LF. Applying that recorded transform reproduces the published file exactly. There is no BOM or executable-code difference.

The inspected original blocks fetch, WebSocket, TCP connections, TLS, HTTP(S), DNS and datagrams by replacing the relevant Node functions and synchronizing builtin ESM exports. It preserves local path/named-pipe IPC. This is the previously disclosed process-level Node guard, not an OS firewall or subprocess sandbox. Its protection is unchanged by removal of trailing blank whitespace. The build runner imports and hashes the same artifacts/issue201/network-deny.mjs path. Retained original receipt records exit0, unchanged configuration and zero observed guard attempts. No assertion of broader OS-level isolation is made.

original-network-deny.mjs.base64 preserves the inspected original bytes across Git newline normalization. It contains only the already-public guard source, with no configuration values, credentials or customer data. Decode as base64 to recover the exact helper. comparison.json binds both hashes and unchanged receipt hashes. verify.mjs verifies the preserved bytes, exact suffix difference, published file and original receipt's guard hash without executing the guard or making network requests.

Original receipt, original local guard, published guard and prior manifest remain unchanged. This additive packet corrects their missing byte-level mapping. Application src tree remains c837cf19d436ee2ce5161abd839b76f5f6d2ad97. No build, suite, browser case, source/configuration change, production operation or geometry save was repeated. Additional discretionary spending initiated $0; existing live allowances remain unchanged.

Run from repository root: `node docs/reviews/saved-boundary-context/e1/verify.mjs`.
