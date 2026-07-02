import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const { id, reportId } = await params;
  const cookieStore = await cookies();

  const res = await fetch(
    `${API_URL}/reports/${reportId}?project_id=${id}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieStore.toString(),
      },
    }
  );

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
