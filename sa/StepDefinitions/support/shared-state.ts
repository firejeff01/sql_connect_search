let lastError: Error | null = null;

export function setLastError(error: Error | null): void {
  lastError = error;
}

export function getLastError(): Error | null {
  return lastError;
}

export function resetSharedState(): void {
  lastError = null;
}
