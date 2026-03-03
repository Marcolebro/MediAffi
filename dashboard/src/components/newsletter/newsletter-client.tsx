"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { updateSponsor } from "@/lib/queries/newsletter";
import type { Newsletter, Sponsor, Site } from "@/lib/types/database";
import { formatDate } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { SponsorForm } from "./sponsor-form";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

type NewsletterWithSite = Newsletter & { sites: { name: string } | null };
type SponsorWithSite = Sponsor & { sites: { name: string } | null };

type NewsletterClientProps = {
  newsletters: NewsletterWithSite[];
  sponsors: SponsorWithSite[];
  sites: Site[];
};

function getStatusColor(status: string) {
  switch (status) {
    case "sent":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "draft":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

export function NewsletterClient({
  newsletters,
  sponsors,
  sites,
}: NewsletterClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sponsorFormOpen, setSponsorFormOpen] = useState(false);

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  async function handleToggleSponsor(sponsor: SponsorWithSite) {
    try {
      await updateSponsor(supabase, sponsor.id, { active: !sponsor.active });
      toast.success(
        `Sponsor ${!sponsor.active ? "activated" : "deactivated"}`
      );
      router.refresh();
    } catch (err) {
      toast.error("Failed to update sponsor");
      console.error(err);
    }
  }

  function handleSponsorSuccess() {
    setSponsorFormOpen(false);
    toast.success("Sponsor created");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Send History */}
      <Card>
        <CardHeader>
          <CardTitle>Send History</CardTitle>
        </CardHeader>
        <CardContent>
          {newsletters.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No newsletters sent yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Subject</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Open Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newsletters.map((nl) => {
                  const openRate =
                    nl.recipients > 0
                      ? ((nl.opens / nl.recipients) * 100).toFixed(1)
                      : "0.0";

                  return (
                    <>
                      <TableRow
                        key={nl.id}
                        className="cursor-pointer"
                        onClick={() => toggleExpand(nl.id)}
                      >
                        <TableCell>
                          {expandedId === nl.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate font-medium">
                          {nl.subject}
                        </TableCell>
                        <TableCell>{nl.sites?.name ?? "--"}</TableCell>
                        <TableCell>
                          {nl.sent_at ? formatDate(nl.sent_at) : "--"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {nl.recipients.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {nl.opens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {nl.clicks.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {openRate}%
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(nl.status)}>
                            {nl.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {expandedId === nl.id && nl.content_html && (
                        <TableRow key={`${nl.id}-content`}>
                          <TableCell colSpan={9} className="p-4">
                            <iframe
                              srcDoc={nl.content_html}
                              className="h-96 w-full rounded border"
                              sandbox=""
                              title={`Newsletter: ${nl.subject}`}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Sponsors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sponsors</CardTitle>
          <Button onClick={() => setSponsorFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Sponsor
          </Button>
        </CardHeader>
        <CardContent>
          {sponsors.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No sponsors yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Placement</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponsors.map((sponsor) => (
                  <TableRow key={sponsor.id}>
                    <TableCell className="font-medium">
                      {sponsor.name}
                    </TableCell>
                    <TableCell>{sponsor.sites?.name ?? "--"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{sponsor.placement}</Badge>
                    </TableCell>
                    <TableCell>
                      {sponsor.start_date
                        ? formatDate(sponsor.start_date)
                        : "--"}
                    </TableCell>
                    <TableCell>
                      {sponsor.end_date
                        ? formatDate(sponsor.end_date)
                        : "--"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {sponsor.price != null
                        ? `€${sponsor.price.toFixed(2)}`
                        : "--"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={sponsor.active}
                        onCheckedChange={() => handleToggleSponsor(sponsor)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SponsorForm
        sites={sites}
        open={sponsorFormOpen}
        onOpenChange={setSponsorFormOpen}
        onSuccess={handleSponsorSuccess}
      />
    </div>
  );
}
