import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { system_prompt, template, model, temperature, max_tokens } = body;

    if (!template || !model) {
      return NextResponse.json(
        { error: "Missing required fields: template and model" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiBody: Record<string, unknown> = {
      contents: [{ parts: [{ text: template }] }],
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: max_tokens ?? 4000,
      },
    };

    if (system_prompt) {
      geminiBody.systemInstruction = { parts: [{ text: system_prompt }] };
    }

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: `Gemini API error: ${response.status} ${response.statusText}`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    const resultText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

    if (!resultText) {
      return NextResponse.json(
        { error: "No content in Gemini response", details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ result: resultText });
  } catch (err) {
    console.error("Prompt test error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
