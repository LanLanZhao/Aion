import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRelayHandler } from "./lib/app.mjs";
import { loadOrCreateConfig } from "./lib/config.mjs";
import { readSshConfig, runSshCommand, runSshTest } from "./lib/ssh.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(here, "relay.config.json");
const dataFile = join(here, "data", "servers.json");

function lanAddresses() {
  const found = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === "IPv4" && !item.internal) found.push(item.address);
    }
  }
  return found;
}

let config;
try {
  config = loadOrCreateConfig(configPath);
} catch (error) {
  console.error(`Unable to read relay config: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

const server = createServer(
  createRelayHandler({
    token: config.token,
    dataFile,
    sshTest: runSshTest,
    runCommand: runSshCommand,
    readSshConfig,
  }),
);

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`Port ${config.port} is already in use. Change "port" in relay/relay.config.json.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  const addresses = lanAddresses();
  const shown = addresses.length ? addresses : ["127.0.0.1"];
  console.log("Quest research relay is running");
  for (const address of shown) console.log(`  address  http://${address}:${config.port}`);
  console.log(`  token    ${config.token}`);
  console.log("Open Quest > Research > Configure relay and enter the address and token.");
  console.log("Press Ctrl+C to stop.");
});

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
