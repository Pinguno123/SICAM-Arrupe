export type Role = "DIRECTOR" | "ADMINISTRADOR" | "RECEPCIONISTA" | "LICENCIADO";

export const PERMISSIONS = {
  DIRECTOR: ["*"],

  ADMINISTRADOR: [
    "view:contracts",
    "create:contracts",
    "update:contracts",
    "view:services",
    "create:services",
    "update:services",
    "view:centers",
    "create:centers",
    "update:centers",
  ],

  RECEPCIONISTA: [
    "view:patients",
    "create:patients",
    "update:patients",
    "view:appointments",
    "create:appointments",
    "confirm:appointments",
  ],

  LICENCIADO: [
    "view:appointments",
    "view:patients",
    "phase:register",
    "phase:read",
    "phase:deliver",
  ],
} as const;

export function can(role: Role, perm: string): boolean {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) {
    return false;
  }
  return rolePermissions.includes("*") || rolePermissions.includes(perm);
}

export function hasAll(role: Role | null | undefined, perms: string[] | undefined | null): boolean {
  if (!role || !Array.isArray(perms) || perms.length === 0) {
    return true;
  }
  return perms.every((perm) => can(role, perm));
}

export function hasAny(role: Role | null | undefined, perms: string[] | undefined | null): boolean {
  if (!role || !Array.isArray(perms) || perms.length === 0) {
    return false;
  }
  return perms.some((perm) => can(role, perm));
}

