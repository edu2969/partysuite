export const ACCOUNT_ROLES = ["ADMINISTRADOR", "PORTERIA", "EMBAJADOR", "NEO"] as const;
 
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
 
export function isAccountRole(value: unknown): value is AccountRole {
  return typeof value === "string" && (ACCOUNT_ROLES as readonly string[]).includes(value);
}
 