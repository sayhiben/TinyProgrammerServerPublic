const MAX_DEVICE_NAME_LENGTH = 32;
const DEVICE_NAME_PATTERN = /^[A-Za-z0-9 _.-]+$/;
export const MAX_DEVICE_NAME_ATTEMPTS = 9999;

export type DeviceNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

type PostgrestErrorLike = {
  code?: string;
  details?: string;
  message?: string;
};

export function normalizeDeviceName(value: unknown): DeviceNameResult {
  if (typeof value !== "string") {
    return { ok: false, error: "preferred_name must be a string" };
  }

  const name = value.trim();
  if (!name) {
    return { ok: false, error: "preferred_name is required" };
  }
  if (name.length > MAX_DEVICE_NAME_LENGTH) {
    return {
      ok: false,
      error:
        `preferred_name must be ${MAX_DEVICE_NAME_LENGTH} characters or less`,
    };
  }
  if (!DEVICE_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      error:
        "preferred_name may only contain letters, numbers, spaces, underscores, hyphens, and periods",
    };
  }

  return { ok: true, name };
}

export function deviceNameCandidate(name: string, attempt: number): string {
  if (attempt <= 1) {
    return name;
  }
  const suffix = `-${attempt}`;
  return `${
    name.slice(0, MAX_DEVICE_NAME_LENGTH - suffix.length).trimEnd()
  }${suffix}`;
}

export function isUniqueConstraintError(
  error: PostgrestErrorLike | null | undefined,
  constraintName: string,
): boolean {
  if (error?.code !== "23505") {
    return false;
  }
  const detail = `${error.message ?? ""} ${error.details ?? ""}`;
  return detail.includes(constraintName);
}
