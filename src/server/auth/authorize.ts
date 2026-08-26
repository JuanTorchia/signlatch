import type { SessionRole } from "./session";
import type { SecurityStore } from "../workflow/security-store";

export type CapabilityAction =
  | "read"
  | "prepare"
  | "mutate"
  | "approve"
  | "dispatch"
  | "audit";

const ACTION_ROLES: Record<CapabilityAction, readonly SessionRole[]> = {
  read: ["operator", "approver", "dispatcher", "auditor"],
  prepare: ["operator"],
  mutate: ["operator"],
  approve: ["approver"],
  dispatch: ["dispatcher"],
  audit: ["auditor"],
};

export function can(roles: readonly SessionRole[], action: CapabilityAction): boolean {
  return ACTION_ROLES[action].some((role) => roles.includes(role));
}

export function requireCapability(roles: readonly SessionRole[], action: CapabilityAction): void {
  if (!can(roles, action)) throw new AuthorizationError();
}

export class AuthorizationError extends Error {
  readonly status = 404;
  constructor() {
    super("Capability denied");
    this.name = "AuthorizationError";
  }
}

export async function requireCurrentCapability(
  store: SecurityStore,
  session: { tenantId: string; principalId: string; roles: readonly SessionRole[] },
  action: CapabilityAction,
): Promise<void> {
  requireCapability(session.roles, action);
  const eligible = ACTION_ROLES[action];
  const checks = await Promise.all(
    eligible.filter((role) => session.roles.includes(role)).map((role) =>
      store.hasCapability(session.tenantId, session.principalId, role),
    ),
  );
  if (!checks.some(Boolean)) throw new AuthorizationError();
}
