"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalLink,
  Github,
  Play,
  Plus,
  Settings,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { Site } from "@/lib/types/database";

type Props = {
  site: Site;
};

export function SiteActions({ site }: Props) {
  const router = useRouter();
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [pagePrompt, setPagePrompt] = useState("");
  const [addPageLoading, setAddPageLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sites/${site.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur");
      if (result.warnings?.length > 0) {
        toast.warning(`Site supprimé avec avertissements: ${result.warnings.join(", ")}`);
      } else {
        toast.success("Site supprimé avec succès");
      }
      router.push("/sites");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer le site
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {site.name} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le site sera supprimé de la base de données,
              le repository GitHub et le projet Vercel seront également supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
