import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const { id, reportId } = await params;
  const cookieStore = await cookies();
  const body = await request.text();

  const res = await fetch(
    `${API_URL}/reports/${reportId}/feedback?project_id=${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieStore.toString(),
      },
      body,
    }
  );

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
