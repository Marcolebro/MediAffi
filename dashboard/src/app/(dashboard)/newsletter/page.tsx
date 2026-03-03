import { createClient } from "@/lib/supabase/server";
import { getNewsletters, getSponsors } from "@/lib/queries/newsletter";
import { getAllSites } from "@/lib/queries/sites";
import { NewsletterClient } from "@/components/newsletter/newsletter-client";

export default async function NewsletterPage() {
  const supabase = await createClient();

  const [newsletters, sponsors, sites] = await Promise.all([
    getNewsletters(supabase),
    getSponsors(supabase),
    getAllSites(supabase),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Newsletter</h1>
      <NewsletterClient
        newsletters={newsletters}
        sponsors={sponsors}
        sites={sites}
      />
    </div>
  );
}
