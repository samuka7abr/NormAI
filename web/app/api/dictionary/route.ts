import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

async function proxy(req: NextRequest, path: string): Promise<Response> {
  const cookieStore = await cookies();
  const url = new URL(path, API_URL);
  req.nextUrl.searchParams.forEach((value, key) =>
    url.searchParams.set(key, value)
  );
  const body = req.method !== "GET" ? await req.text() : undefined;
  return fetch(url.toString(), {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieStore.toString(),
    },
    body,
  });
}

export async function GET(request: NextRequest) {
  const res = await proxy(request, "/dictionary");
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function POST(request: NextRequest) {
  const res = await proxy(request, "/dictionary");
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
