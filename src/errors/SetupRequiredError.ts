export interface SetupRequiredDetails {
  suggestedTool?: string;
  missingFields?: string[];
  suggestedConnectionType?: "mysql2";
}

export class SetupRequiredError extends Error {
  readonly details: SetupRequiredDetails;

  constructor(message: string, details: SetupRequiredDetails = {}) {
    super(message);
    this.name = "SetupRequiredError";
    this.details = details;
  }
}
