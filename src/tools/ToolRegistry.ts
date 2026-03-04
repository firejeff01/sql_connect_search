import type { ToolDefinition } from "./ITool.ts";

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<unknown, unknown>>();

  registerTools(tools: ToolDefinition<unknown, unknown>[]): void {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  getRegisteredTools(): ToolDefinition<unknown, unknown>[] {
    return [...this.tools.values()];
  }

  async executeTool(name: string, input: unknown, context?: { client?: string }): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' is not registered`);
    }
    return tool.execute(input, context);
  }
}
