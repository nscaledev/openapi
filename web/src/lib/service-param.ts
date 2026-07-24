const SERVICE_ID_PATTERN = /^[a-z0-9-]+$/;

export function isValidServiceId(
  raw: string | undefined | null
): raw is string {
  if (typeof raw !== "string") return false;
  return SERVICE_ID_PATTERN.test(raw);
}
