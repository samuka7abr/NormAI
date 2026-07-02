import { NextResponse } from "next/server";
import { verifyOTP, setResetToken } from "@/lib/reset-store";

export async function POST(req: Request) {
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const result = verifyOTP(email, code);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const token = `reset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setResetToken(token, email);

  return NextResponse.json({ token });
}
