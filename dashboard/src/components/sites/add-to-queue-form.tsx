"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addToQueue } from "@/lib/queries/queue";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

type QueueRow = {
  keyword: string;
  type: string;
  priority: number;
};

type Props = {
  siteId: string;
  onSuccess: () => void;
};

const ARTICLE_TYPES = [
  { value: "review", label: "Review" },
  { value: "comparatif", label: "Comparatif" },
  { value: "top_list", label: "Top List" },
  { value: "guide", label: "Guide" },
  { value: "actu", label: "Actu" },
];

export function AddToQueueForm({ siteId, onSuccess }: Props) {
  const [rows, setRows] = useState<QueueRow[]>([
    { keyword: "", type: "review", priority: 1 },
  ]);
  const [loading, setLoading] = useState(false);

  function addRow() {
    const nextPriority = rows.length > 0 ? Math.max(...rows.map((r) => r.priority)) + 1 : 1;
    setRows([...rows, { keyword: "", type: "review", priority: nextPriority }]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: keyof QueueRow, value: string | number) {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validRows = rows.filter((r) => r.keyword.trim());
    if (validRows.length === 0) {
      toast.error("Add at least one keyword.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      await addToQueue(
        supabase,
        validRows.map((r) => ({
          site_id: siteId,
          keyword: r.keyword.trim(),
          type: r.type,
          priority: r.priority,
        }))
      );
      toast.success(`${validRows.length} item(s) added to queue.`);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add to queue";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Keyword</Label>
              <Input
                value={row.keyword}
                onChange={(e) => updateRow(index, "keyword", e.target.value)}
                placeholder="meilleur aspirateur robot 2025"
              />
            </div>
            <div className="w-[140px] space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={row.type}
                onValueChange={(v) => updateRow(index, "type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARTICLE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[80px] space-y-1">
              <Label className="text-xs">Priority</Label>
              <Input
                type="number"
                min={1}
                value={row.priority}
                onChange={(e) =>
                  updateRow(index, "priority", parseInt(e.target.value) || 1)
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRow(index)}
              disabled={rows.length <= 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-2 h-4 w-4" />
        Add row
      </Button>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add to Queue"}
        </Button>
      </div>
    </form>
  );
}
