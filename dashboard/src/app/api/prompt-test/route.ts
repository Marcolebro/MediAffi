import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callAI } from "@/lib/ai";

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

    const { text } = await callAI({
      prompt: template,
      systemPrompt: system_prompt || undefined,
      model,
      temperature: temperature ?? 0.7,
      maxTokens: max_tokens ?? 4000,
    });

    return NextResponse.json({ result: text });
  } catch (err) {
    console.error("Prompt test error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
