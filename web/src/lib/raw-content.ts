export const RAW_CONTENT_BASE =
  "https://raw.githubusercontent.com/nscaledev/openapi/main";

export async function fetchServiceIndex(): Promise<unknown> {
  const response = await fetch(`${RAW_CONTENT_BASE}/index.json`, {
    next: { revalidate: 60 },
  });
  if (!response.ok) {
    throw new Error(`fetchServiceIndex: upstream returned ${response.status}`);
  }
  return response.json();
}

export async function fetchServiceSpecYaml(
  serviceId: string
): Promise<string | null> {
  const response = await fetch(
    `${RAW_CONTENT_BASE}/specs/${serviceId}/openapi.yaml`,
    { next: { revalidate: 60 } }
  );
  if (!response.ok) return null;
  return response.text();
}

export function serviceSpecJsonUrl(serviceId: string): string {
  return `${RAW_CONTENT_BASE}/specs/${serviceId}/openapi.json`;
}
