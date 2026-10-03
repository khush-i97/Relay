import { routeError } from "../../../../lib/server/http";
import { handleVisit } from "../../../../lib/server/mutations";
import { validateWriteOrigin } from "../../../../lib/server/origin";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    validateWriteOrigin(request);
    return await handleVisit(request);
  } catch (error) {
    return routeError(error);
  }
}
