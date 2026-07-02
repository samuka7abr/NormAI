import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

async function proxy(req: NextRequest, path: string): Promise<Response> {
  const cookieStore = await cookies();
  const body =
    req.method !== "GET" && req.method !== "DELETE"
      ? await req.text()
      : undefined;
  return fetch(`${API_URL}${path}`, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieStore.toString(),
    },
    body,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  const res = await proxy(request, `/dictionary/${entryId}`);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  const res = await proxy(request, `/dictionary/${entryId}`);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  const res = await proxy(request, `/dictionary/${entryId}`);
  if (res.status === 204) return new Response(null, { status: 204 });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
