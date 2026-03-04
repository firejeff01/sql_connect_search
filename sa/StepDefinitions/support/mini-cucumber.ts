export type StepHandler = (...args: any[]) => unknown | Promise<unknown>;

export interface RegisteredStep {
  kind: "Given" | "When" | "Then" | "Before";
  pattern: string | RegExp;
  handler: StepHandler;
}

const registry: RegisteredStep[] = [];

function register(kind: RegisteredStep["kind"], pattern: string | RegExp, handler: StepHandler): void {
  registry.push({ kind, pattern, handler });
}

export function Given(pattern: string | RegExp, handler: StepHandler): void {
  register("Given", pattern, handler);
}

export function When(pattern: string | RegExp, handler: StepHandler): void {
  register("When", pattern, handler);
}

export function Then(pattern: string | RegExp, handler: StepHandler): void {
  register("Then", pattern, handler);
}

export function Before(handler: StepHandler): void {
  register("Before", /^before$/, handler);
}

export function getRegisteredSteps(): RegisteredStep[] {
  return [...registry];
}
