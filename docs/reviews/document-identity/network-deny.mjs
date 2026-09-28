import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import {syncBuiltinESMExports} from 'node:module';
function deny(kind) {
  if(process.env.EE_BUILD_NETWORK_LOG) fs.appendFileSync(process.env.EE_BUILD_NETWORK_LOG, JSON.stringify({kind,pid:process.pid,time:new Date().toISOString()})+'\n');
  throw new Error('PR194 isolated build blocked network operation: '+kind);
}
globalThis.fetch=()=>deny('fetch');
if(globalThis.WebSocket) globalThis.WebSocket=class {constructor(){deny('WebSocket');}};
for(const [mod,names] of [[net,['connect','createConnection']],[tls,['connect']],[http,['request','get']],[https,['request','get']],[dns,['lookup','resolve','resolve4','resolve6']],[dns.promises,['lookup','resolve','resolve4','resolve6']],[dgram,['createSocket']]])for(const name of names) mod[name]=()=>deny(name);
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
 const values=Array.isArray(args[0])?args[0]:args;
 const first=values[0];
 // Preserve local named-pipe IPC, including compiler IPC. Deny every TCP socket.
 if((typeof first==='object' && first?.path)||(typeof first==='string' && first.startsWith('\\\\.\\pipe\\')))return connect.apply(this,args);
 return deny('TCP socket');
};
syncBuiltinESMExports();
