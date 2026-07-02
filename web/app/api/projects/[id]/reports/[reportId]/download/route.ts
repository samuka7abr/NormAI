import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const { id, reportId } = await params;
  const cookieStore = await cookies();
  const executionId = request.nextUrl.searchParams.get("executionId");
  const wantsRawFile = request.nextUrl.searchParams.get("raw") === "1";

  if (wantsRawFile) {
    const res = await fetch(
      `${API_URL}/reports/${reportId}/executions/${executionId}/download?project_id=${id}&stream=true`,
      {
        method: "GET",
        headers: {
          Cookie: cookieStore.toString(),
        },
      }
    );

    if (!res.ok) {
      const detail = await res.text();
      return Response.json(
        { detail: detail || "Não foi possível baixar o arquivo processado." },
        { status: res.status }
      );
    }

    const headers = new Headers();
    const contentType = res.headers.get("content-type");
    const contentLength = res.headers.get("content-length");
    const contentDisposition = res.headers.get("content-disposition");
    if (contentType) headers.set("content-type", contentType);
    if (contentLength) headers.set("content-length", contentLength);
    if (contentDisposition) headers.set("content-disposition", contentDisposition);

    return new Response(res.body, { status: res.status, headers });
  }

  const res = await fetch(
    `${API_URL}/reports/${reportId}/executions/${executionId}/download?project_id=${id}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieStore.toString(),
      },
    }
  );

  const data = await res.json();
  if (!res.ok) return Response.json(data, { status: res.status });

  return Response.json(data, { status: res.status });
}
