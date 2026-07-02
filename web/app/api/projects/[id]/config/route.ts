import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

async function proxy(req: NextRequest, path: string): Promise<Response> {
  const cookieStore = await cookies();
  const contentType = req.headers.get("Content-Type") ?? "application/json";
  const body =
    req.method !== "GET" ? await req.arrayBuffer() : undefined;

  return fetch(`${API_URL}${path}`, {
    method: req.method,
    headers: {
      "Content-Type": contentType,
      Cookie: cookieStore.toString(),
    },
    body,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await proxy(request, `/projects/${id}/columns`);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await proxy(request, `/projects/${id}/columns`);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await proxy(request, `/projects/${id}/columns/detect`);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
