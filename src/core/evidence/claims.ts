export const claimStatuses = ["implemented", "live-demonstrated", "fixture-demonstrated", "planned"] as const;
export type ClaimStatus = (typeof claimStatuses)[number];
export function isClaimStatus(value: unknown): value is ClaimStatus { return typeof value === "string" && claimStatuses.includes(value as ClaimStatus); }
export function assertPublishableClaim(status: ClaimStatus, hasLiveEvidence: boolean): void { if (status === "live-demonstrated" && !hasLiveEvidence) throw new Error("Live claim requires live evidence"); }
