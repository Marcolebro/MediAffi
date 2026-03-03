"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatNumber, getStatusColor } from "@/lib/utils";
import type { Article } from "@/lib/types/database";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  articles: Article[];
  siteId: string;
  total: number;
  filters: {
    type?: string;
    status?: string;
    page: number;
  };
};

const PER_PAGE = 25;

const ARTICLE_TYPES = [
  { value: "all", label: "All types" },
  { value: "review", label: "Review" },
  { value: "comparatif", label: "Comparatif" },
  { value: "top_list", label: "Top List" },
  { value: "guide", label: "Guide" },
  { value: "actu", label: "Actu" },
];

const ARTICLE_STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function ArticlesClient({ articles, siteId, total, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all" || !value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      // Reset to page 1 when filters change
      if (key !== "page") {
        params.delete("page");
      }
      const queryString = params.toString();
      router.push(queryString ? `?${queryString}` : "?");
    },
    [router, searchParams]
  );

  const goToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }
      const queryString = params.toString();
      router.push(queryString ? `?${queryString}` : "?");
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Select
          value={filters.type || "all"}
          onValueChange={(value) => updateFilter("type", value)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            {ARTICLE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status || "all"}
          onValueChange={(value) => updateFilter("status", value)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {ARTICLE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-sm text-muted-foreground">
          {total} article{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Words</TableHead>
              <TableHead className="text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No articles found
                </TableCell>
              </TableRow>
            ) : (
              articles.map((article) => (
                <TableRow
                  key={article.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(
                      `/sites/${siteId}/articles/${article.id}`
                    )
                  }
                >
                  <TableCell className="max-w-[400px] truncate font-medium">
                    {article.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{article.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(article.status)}>
                      {article.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {article.word_count != null
                      ? formatNumber(article.word_count)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {formatDate(article.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(filters.page - 1)}
            disabled={filters.page <= 1}
          >
            <ChevronLeft />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {filters.page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(filters.page + 1)}
            disabled={filters.page >= totalPages}
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
