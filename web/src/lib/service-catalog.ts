export type ServiceCatalogEntry = {
  id: string;
  title: string;
  version: string;
  specUrl: string;
  jsonUrl: string;
  docsUrl: string | null;
};

type RawServiceEntry = {
  id?: unknown;
  title?: unknown;
  version?: unknown;
  spec?: { yaml?: unknown; json?: unknown };
  docs?: unknown;
};

type RawIndexDocument = {
  services?: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function shapeCatalog(index: unknown): ServiceCatalogEntry[] {
  const doc = index as RawIndexDocument | null | undefined;
  const services = Array.isArray(doc?.services)
    ? (doc!.services as RawServiceEntry[])
    : [];

  return services
    .filter((entry) => isNonEmptyString(entry.id))
    .map((entry) => ({
      id: entry.id as string,
      title: isNonEmptyString(entry.title) ? entry.title : (entry.id as string),
      version: isNonEmptyString(entry.version) ? entry.version : "0.0.0",
      specUrl: isNonEmptyString(entry.spec?.yaml) ? (entry.spec!.yaml as string) : "",
      jsonUrl: isNonEmptyString(entry.spec?.json) ? (entry.spec!.json as string) : "",
      docsUrl: isNonEmptyString(entry.docs) ? (entry.docs as string) : null,
    }));
}
