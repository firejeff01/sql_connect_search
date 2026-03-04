import readline from "node:readline";
import { createJsonRpcErrorFromUnknown, type JsonRpcHandlerResult, type JsonRpcRequest } from "./protocol.ts";

export class StdioTransport {
  readonly type = "stdio";

  async processMessage(
    payload: string,
    handler: (request: JsonRpcRequest) => Promise<JsonRpcHandlerResult>
  ): Promise<string | null> {
    const request = JSON.parse(payload) as JsonRpcRequest;
    const response = await handler(request);
    return response ? JSON.stringify(response) : null;
  }

  async startLoop(
    handler: (request: JsonRpcRequest) => Promise<JsonRpcHandlerResult>
  ): Promise<void> {
    const lineReader = readline.createInterface({
      input: process.stdin,
      crlfDelay: Infinity
    });

    for await (const line of lineReader) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const output = await this.processMessage(trimmed, handler);
        if (output) {
          process.stdout.write(`${output}\n`);
        }
      } catch (error) {
        process.stdout.write(`${JSON.stringify(createJsonRpcErrorFromUnknown(null, error, "transport"))}\n`);
      }
    }
  }
}
