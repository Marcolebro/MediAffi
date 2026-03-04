import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Adresse email invalide." },
        { status: 400 }
      );
    }

    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey) {
      // If no Resend key, just acknowledge the subscription
      return NextResponse.json({ success: true, message: "Inscription enregistrée." });
    }

    const res = await fetch("https://api.resend.com/audiences/default/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        email,
        unsubscribed: false,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data.message ?? "Erreur lors de l'inscription." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Inscription réussie !" });
  } catch {
    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
