import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { authenticateLocalRequest } from "../local-auth";
import { DISABLED_ACCOUNT_MESSAGE } from "../account-suspension";
import { ForbiddenError } from "@shared/_core/errors";

export type AuthenticatedUser = User & { taskUid?: string; isCron?: boolean };

class SDKServer {
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const user = await authenticateLocalRequest(req);
    if (!user) throw ForbiddenError("Invalid local session cookie");
    if (user.disabledAt) throw ForbiddenError(DISABLED_ACCOUNT_MESSAGE);
    return user;
  }
}

export const sdk = new SDKServer();
