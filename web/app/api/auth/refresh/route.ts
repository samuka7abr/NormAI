import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieStore.toString(),
    },
  });

  const data = await res.json();
  const headers = new Headers({ "Content-Type": "application/json" });
  res.headers.getSetCookie().forEach((c) => headers.append("Set-Cookie", c));
  return new Response(JSON.stringify(data), { status: res.status, headers });
}
