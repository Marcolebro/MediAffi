"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalLink,
  Github,
  Play,
  Plus,
  Settings,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type { Site } from "@/lib/types/database";

type Props = {
  site: Site;
};

export function SiteActions({ site }: Props) {
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [pagePrompt, setPagePrompt] = useState("");
  const [addPageLoading, setAddPageLoading] = useState(false);

  async function handleRunPipeline() {
    setPipelineLoading(true);
    try {
      const res = await fetch("/api/run-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: site.id }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let lastTitle = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.step === "complete" && event.status === "done") {
              lastTitle = event.title || "article";
              toast.success(`Article "${lastTitle}" généré et publié !`);
            } else if (event.status === "error") {
              toast.error(`Erreur: ${event.error}`);
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur pipeline");
    } finally {
      setPipelineLoading(false);
    }
  }

  async function handleAddPage() {
    if (!pagePrompt.trim()) {
      toast.error("Décrivez la page à ajouter.");
      return;
    }
    setAddPageLoading(true);
    try {
      const res = await fetch("/api/update-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          action: "add_page",
          data: { prompt: pagePrompt },
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur");
      toast.success(`Page ajoutée (${result.filesCount} fichiers) !`);
      setAddPageOpen(false);
      setPagePrompt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setAddPageLoading(false);
    }
  }

  async function handleRebuild() {
    try {
      const res = await fetch("/api/update-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          action: "rebuild",
          data: {},
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur");
      toast.success("Redéploiement lancé !");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Voir le site */}
      {site.domain && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={site.domain.startsWith("http") ? site.domain : `https://${site.domain}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Voir le site
          </a>
        </Button>
      )}

      {/* Voir le repo */}
      {site.github_repo && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={`https://github.com/${site.github_repo}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github className="mr-2 h-4 w-4" />
            Repo
          </a>
        </Button>
      )}

      {/* Lancer le pipeline */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRunPipeline}
        disabled={pipelineLoading}
      >
        {pipelineLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        Pipeline
      </Button>

      {/* Ajouter une page */}
      <Dialog open={addPageOpen} onOpenChange={setAddPageOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Page
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={pagePrompt}
              onChange={(e) => setPagePrompt(e.target.value)}
              placeholder="Décrivez la page à ajouter (ex: page de contact avec formulaire, page FAQ...)"
              rows={4}
            />
            <Button
              onClick={handleAddPage}
              disabled={addPageLoading}
              className="w-full"
            >
              {addPageLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Génération...
                </>
              ) : (
                "Générer la page"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mettre à jour */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleRebuild}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Forcer le redéploiement
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
