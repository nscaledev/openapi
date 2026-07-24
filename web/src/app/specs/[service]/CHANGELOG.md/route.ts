import { fetchServiceChangelog } from "@/lib/raw-content";
import { isValidServiceId } from "@/lib/service-param";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service } = await params;
  if (!isValidServiceId(service)) {
    return new Response("Not found", { status: 404 });
  }

  const changelog = await fetchServiceChangelog(service);
  if (changelog === null) {
    return new Response("Changelog temporarily unavailable", { status: 502 });
  }

  return new Response(changelog, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=60",
    },
  });
}
