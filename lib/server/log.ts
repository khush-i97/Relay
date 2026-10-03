import { sanitizeLog } from "./http";

export function logEvent(fields: Record<string, unknown>): void {
  console.info(JSON.stringify(sanitizeLog(fields)));
}
