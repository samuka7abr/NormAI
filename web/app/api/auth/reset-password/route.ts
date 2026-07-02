import { NextResponse } from "next/server";
import { consumeResetToken } from "@/lib/reset-store";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

export async function POST(req: Request) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const result = consumeResetToken(token);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const backendRes = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: result.email, new_password: password }),
  });

  if (!backendRes.ok) {
    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: data.detail ?? "Falha ao redefinir senha." },
      { status: backendRes.status }
    );
  }

  return NextResponse.json({ message: "Senha redefinida com sucesso." });
}
