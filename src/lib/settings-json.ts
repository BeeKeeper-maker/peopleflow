import type { Prisma } from "@/generated/prisma";

export type PlainSettings = Record<string, unknown>;

/**
 * Organization.settings is JSONB in the current schema, but older imports/logs may
 * still contain stringified JSON. Normalize both shapes before merging nested keys.
 */
export function toPlainSettings(value: Prisma.JsonValue | unknown): PlainSettings {
  if (!value) return {};

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return isPlainObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return isPlainObject(value) ? value : {};
}

export function boolSetting(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isPlainObject(value: unknown): value is PlainSettings {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
