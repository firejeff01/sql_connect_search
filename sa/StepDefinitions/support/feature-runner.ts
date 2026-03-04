import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { getRegisteredSteps, type RegisteredStep } from "./mini-cucumber.ts";

type StepKeyword = "Given" | "When" | "Then" | "And";

interface DataTable {
  hashes(): Array<Record<string, string>>;
  raw(): string[][];
}

interface ParsedStep {
  keyword: StepKeyword;
  text: string;
  table?: DataTable;
}

interface ParsedScenario {
  name: string;
  steps: ParsedStep[];
}

interface ParsedFeature {
  name: string;
  background: ParsedStep[];
  scenarios: ParsedScenario[];
}

export interface FeatureRunResult {
  feature: string;
  featureName: string;
  scenarios: number;
  steps: number;
  scenarioNames: string[];
}

function createDataTable(rows: string[][]): DataTable {
  return {
    hashes(): Array<Record<string, string>> {
      if (rows.length < 2) {
        return [];
      }
      const [headers, ...dataRows] = rows;
      return dataRows.map((row) => {
        const record: Record<string, string> = {};
        headers.forEach((header, index) => {
          record[header] = row[index] ?? "";
        });
        return record;
      });
    },
    raw(): string[][] {
      return rows.map((row) => [...row]);
    }
  };
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function substituteOutline(text: string, values: Record<string, string>): string {
  return text.replace(/<([^>]+)>/g, (match, key) => (key in values ? values[key] : match));
}

function parseFeature(content: string): ParsedFeature {
  const lines = content.split(/\r?\n/);
  const feature: ParsedFeature = { name: "unknown", background: [], scenarios: [] };
  let mode: "feature" | "background" | "scenario" | "outline" = "feature";
  let currentScenario: ParsedScenario | null = null;
  let outlineTemplate: ParsedScenario | null = null;
  let pendingStep: ParsedStep | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("Feature:")) {
      feature.name = line.slice("Feature:".length).trim();
      continue;
    }

    if (line.startsWith("Background:")) {
      mode = "background";
      currentScenario = null;
      outlineTemplate = null;
      pendingStep = null;
      continue;
    }

    if (line.startsWith("Scenario Outline:")) {
      mode = "outline";
      outlineTemplate = {
        name: line.slice("Scenario Outline:".length).trim(),
        steps: []
      };
      currentScenario = null;
      pendingStep = null;
      continue;
    }

    if (line.startsWith("Scenario:")) {
      mode = "scenario";
      currentScenario = {
        name: line.slice("Scenario:".length).trim(),
        steps: []
      };
      feature.scenarios.push(currentScenario);
      outlineTemplate = null;
      pendingStep = null;
      continue;
    }

    if (line.startsWith("Examples:")) {
      if (!outlineTemplate) {
        continue;
      }
      const rows: string[][] = [];
      let cursor = index + 1;
      while (cursor < lines.length && lines[cursor].trim().startsWith("|")) {
        rows.push(parseTableRow(lines[cursor]));
        cursor += 1;
      }
      index = cursor - 1;
      const table = createDataTable(rows).hashes();
      for (const row of table) {
        feature.scenarios.push({
          name: substituteOutline(outlineTemplate.name, row),
          steps: outlineTemplate.steps.map((step) => ({
            keyword: step.keyword,
            text: substituteOutline(step.text, row),
            table: step.table
              ? createDataTable(step.table.raw().map((cells) => cells.map((cell) => substituteOutline(cell, row))))
              : undefined
          }))
        });
      }
      continue;
    }

    const stepMatch = /^(Given|When|Then|And)\s+(.+)$/.exec(line);
    if (stepMatch) {
      const step: ParsedStep = {
        keyword: stepMatch[1] as StepKeyword,
        text: stepMatch[2]
      };
      pendingStep = step;
      if (mode === "background") {
        feature.background.push(step);
      } else if (mode === "outline" && outlineTemplate) {
        outlineTemplate.steps.push(step);
      } else if (currentScenario) {
        currentScenario.steps.push(step);
      }
      continue;
    }

    if (line.startsWith("|") && pendingStep) {
      const currentRows = pendingStep.table?.raw() ?? [];
      pendingStep.table = createDataTable([...currentRows, parseTableRow(line)]);
    }
  }

  return feature;
}

function toRegex(pattern: string | RegExp): RegExp {
  if (pattern instanceof RegExp) {
    return pattern;
  }

  let regex = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "\\") {
      index += 1;
      regex += escapeRegex(pattern[index] ?? "");
      continue;
    }

    if (char === "{") {
      const end = pattern.indexOf("}", index);
      if (end >= 0) {
        const token = pattern.slice(index + 1, end);
        if (token === "string") {
          regex += '"([^"]*)"';
          index = end;
          continue;
        }
        if (token === "int") {
          regex += "(-?\\d+)";
          index = end;
          continue;
        }
        if (token === "word") {
          regex += "(\\S+)";
          index = end;
          continue;
        }
      }
    }

    regex += escapeRegex(char);
  }
  regex += "$";
  return new RegExp(regex);
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function convertArg(value: string): string | number {
  return /^-?\d+$/.test(value) ? Number(value) : value;
}

function scorePattern(pattern: string | RegExp): number {
  if (pattern instanceof RegExp) {
    return 0;
  }
  const placeholderPenalty = (pattern.match(/\{(string|int|word)\}/g) ?? []).length * 10;
  return pattern.length - placeholderPenalty;
}

function findStepDefinition(step: ParsedStep, inheritedKeyword: Exclude<StepKeyword, "And">): { stepDef: RegisteredStep; match: RegExpMatchArray } {
  const searchKinds: RegisteredStep["kind"][] =
    step.keyword === "And" ? [inheritedKeyword, "Given", "When", "Then"] : [step.keyword];

  let bestMatch: { stepDef: RegisteredStep; match: RegExpMatchArray; score: number } | null = null;
  for (const kind of searchKinds) {
    const candidates = getRegisteredSteps().slice().reverse();
    for (const stepDef of candidates) {
      if (stepDef.kind !== kind) {
        continue;
      }
      const regex = toRegex(stepDef.pattern);
      const match = step.text.match(regex);
      if (match) {
        const score = scorePattern(stepDef.pattern);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { stepDef, match, score };
        }
      }
    }
    if (bestMatch) {
      return { stepDef: bestMatch.stepDef, match: bestMatch.match };
    }
  }

  throw new Error(`No step definition matched: ${step.text}`);
}

async function runScenario(feature: ParsedFeature, scenario: ParsedScenario): Promise<number> {
  let stepCount = 0;
  for (const beforeHook of getRegisteredSteps().filter((item) => item.kind === "Before")) {
    await beforeHook.handler();
  }

  let previousKeyword: Exclude<StepKeyword, "And"> = "Given";
  const steps = [...feature.background, ...scenario.steps];
  for (const step of steps) {
    const resolvedKeyword = step.keyword === "And" ? previousKeyword : step.keyword;
    const { stepDef, match } = findStepDefinition(step, previousKeyword);
    const args = match.slice(1).map((item) => convertArg(item));
    if (step.table) {
      args.push(step.table);
    }
    try {
      await stepDef.handler(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[${feature.name}] [${scenario.name}] [${step.keyword} ${step.text}] ${message}`
      );
    }
    previousKeyword = resolvedKeyword;
    stepCount += 1;
  }
  return stepCount;
}

export async function runFeatureFile(featurePath: string): Promise<FeatureRunResult> {
  const content = await readFile(featurePath, "utf8");
  const feature = parseFeature(content);
  let steps = 0;
  for (const scenario of feature.scenarios) {
    steps += await runScenario(feature, scenario);
  }

  return {
    feature: basename(featurePath),
    featureName: feature.name,
    scenarios: feature.scenarios.length,
    steps,
    scenarioNames: feature.scenarios.map((item) => item.name)
  };
}
