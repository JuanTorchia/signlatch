import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET(_request: Request, context: RouteContext<"/api/artifacts/[sha]">) {
  const { sha } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(sha)) return new Response("Not found", { status: 404 });

  try {
    const filePath = path.join(process.cwd(), ".data", "artifacts", "sha256", sha.slice(0, 2), `${sha}.pdf`);
    const bytes = await readFile(filePath);
    return new Response(bytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="signlatch-${sha.slice(0, 12)}.pdf"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
