import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const url = new URL(`/projects/${id}/reports`, API_URL);
  request.nextUrl.searchParams.forEach((value, key) =>
    url.searchParams.set(key, value)
  );

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieStore.toString(),
    },
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const contentType = request.headers.get("Content-Type") ?? "application/octet-stream";
  const body = await request.arrayBuffer();

  const res = await fetch(`${API_URL}/projects/${id}/reports`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Cookie: cookieStore.toString(),
    },
    body,
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
