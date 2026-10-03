import { routeError } from "../../../../lib/server/http";
import { handleRedemption } from "../../../../lib/server/mutations";
import { validateWriteOrigin } from "../../../../lib/server/origin";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    validateWriteOrigin(request);
    return await handleRedemption(request);
  } catch (error) {
    return routeError(error);
  }
}
