import { NextResponse } from "next/server";
import { Resend } from "resend";
import { checkRateLimit, setOTP } from "@/lib/reset-store";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "E-mail obrigatório." }, { status: 400 });
  }

  if (!checkRateLimit(email)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde 1 hora antes de solicitar novamente." },
      { status: 429 }
    );
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  setOTP(email, code);

  const { error } = await resend.emails.send({
    from: "NormAI <onboarding@resend.dev>",
    to: email,
    subject: "Seu código de verificação — NormAI",
    html: emailTemplate(code),
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json({ error: "Falha ao enviar e-mail." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function emailTemplate(code: string) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
      <h1 style="font-size: 28px; font-weight: 700; color: #1b3630; margin-bottom: 8px;">
        Redefinição de senha
      </h1>
      <p style="color: #666; font-size: 15px; margin-bottom: 32px;">
        Use o código abaixo para redefinir sua senha. Ele expira em 10 minutos.
      </p>
      <div style="background: #f0fdf9; border: 1px solid #b8d9d0; border-radius: 12px;
                  padding: 24px; text-align: center; margin-bottom: 32px;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 0.2em; color: #065F46;">
          ${code}
        </span>
      </div>
      <p style="color: #999; font-size: 13px;">
        Se você não solicitou isso, pode ignorar este e-mail com segurança.
      </p>
    </div>
  `;
}
