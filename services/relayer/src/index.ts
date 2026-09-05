import { loadConfig } from "./config.js";
import { createRelayer } from "./relayer.js";

const running = await createRelayer(loadConfig()).start();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void running.stop().then(() => process.exit(0));
  });
}
