import type { AdventureStreamEvent } from "../../../shared/contracts";

export function encodeSse(event: AdventureStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
