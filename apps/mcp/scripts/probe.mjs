import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [command, ...rest] = process.argv.slice(2);
const calls = JSON.parse(rest[0] ?? "[]");
const transport = new StdioClientTransport({ command: "node", args: [command], env: { ...process.env } });
const client = new Client({ name: "probe", version: "0.0.1" });
await client.connect(transport);
const tools = await client.listTools();
console.log("tools:", tools.tools.map((t) => t.name).join(", "));
for (const [name, args] of calls) {
  const started = Date.now();
  const result = await client.callTool({ name, arguments: args });
  const body = result.content?.[0]?.text ?? JSON.stringify(result);
  console.log(`\n== ${name} (${Math.round((Date.now() - started) / 1000)}s)\n${body.slice(0, 1200)}`);
}
await client.close();
