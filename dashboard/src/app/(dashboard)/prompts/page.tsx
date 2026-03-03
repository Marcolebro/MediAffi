import { createClient } from "@/lib/supabase/server";
import { getAllPrompts } from "@/lib/queries/prompts";
import { PromptsClient } from "@/components/prompts/prompts-client";

export default async function PromptsPage() {
  const supabase = await createClient();
  const prompts = await getAllPrompts(supabase);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prompts</h1>
      <PromptsClient prompts={prompts} />
    </div>
  );
}
