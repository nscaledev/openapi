import { fetchServiceSpecYaml } from "@/lib/raw-content";
import { isValidServiceId } from "@/lib/service-param";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service } = await params;
  if (!isValidServiceId(service)) {
    return new Response("Not found", { status: 404 });
  }

  const yaml = await fetchServiceSpecYaml(service);
  if (yaml === null) {
    return new Response("Spec temporarily unavailable", { status: 502 });
  }

  return new Response(yaml, {
    headers: {
      "Content-Type": "application/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=60",
    },
  });
}
