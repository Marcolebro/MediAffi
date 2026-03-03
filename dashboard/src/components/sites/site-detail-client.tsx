"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LineChart } from "@/components/charts/line-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { AddToQueueForm } from "@/components/sites/add-to-queue-form";
import {
  formatNumber,
  formatCurrency,
  formatDate,
  getStatusColor,
} from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { updateQueuePriority } from "@/lib/queries/queue";
import { toast } from "sonner";
import {
  Plus,
  GripVertical,
  Eye,
  DollarSign,
  FileText,
  Target,
  Instagram,
  Twitter,
  Linkedin,
  Heart,
  MousePointerClick,
  Users,
} from "lucide-react";
import type { Site, ArticleQueue, SocialPost } from "@/lib/types/database";
import type { DailyMetric } from "@/lib/queries/metrics";

type ArticleMetric = {
  article_id: string;
  pageviews: number;
  revenue: number;
  clicks: number;
};

type Props = {
  site: Site;
  queue: ArticleQueue[];
  socialPosts: SocialPost[];
  siteMetrics: DailyMetric[];
  topArticles: ArticleMetric[];
  flopArticles: ArticleMetric[];
};

function SortableQueueItem({ item }: { item: ArticleQueue }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card p-3"
    >
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex flex-1 items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.keyword}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {item.type}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">
            #{item.priority}
          </span>
          <Badge
            variant="secondary"
            className={getStatusColor(item.status)}
          >
            {item.status}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function SiteDetailClient({
  site,
  queue: initialQueue,
  socialPosts,
  siteMetrics,
  topArticles,
  flopArticles,
}: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const totalPageviews = siteMetrics.reduce((s, m) => s + m.pageviews, 0);
  const totalRevenue = siteMetrics.reduce((s, m) => s + m.revenue, 0);
  const totalArticles = topArticles.length + flopArticles.length;
  const avgPosition = 0;

  const chartData = siteMetrics.map((d) => ({
    ...d,
    date: formatDate(d.date, "MMM d"),
  }));

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = queue.findIndex((q) => q.id === active.id);
      const newIndex = queue.findIndex((q) => q.id === over.id);
      const reordered = arrayMove(queue, oldIndex, newIndex);

      setQueue(reordered);

      try {
        const supabase = createClient();
        await Promise.all(
          reordered.map((item, i) =>
            updateQueuePriority(supabase, item.id, i + 1)
          )
        );
      } catch {
        toast.error("Failed to update queue order.");
        setQueue(queue);
      }
    },
    [queue]
  );

  const handleQueueAdded = useCallback(() => {
    setAddDialogOpen(false);
    window.location.reload();
  }, []);

  const platformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "instagram":
        return <Instagram className="h-4 w-4" />;
      case "twitter":
        return <Twitter className="h-4 w-4" />;
      case "linkedin":
        return <Linkedin className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="30d Pageviews"
          value={totalPageviews}
          format="number"
          icon={Eye}
        />
        <StatCard
          title="30d Revenue"
          value={totalRevenue}
          format="currency"
          icon={DollarSign}
        />
        <StatCard
          title="Articles Tracked"
          value={totalArticles}
          icon={FileText}
        />
        <StatCard
          title="Avg Position"
          value={avgPosition}
          icon={Target}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Traffic (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={chartData}
              xKey="date"
              lines={[{ key: "pageviews", label: "Pageviews" }]}
              height={250}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Revenue (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={chartData}
              xKey="date"
              bars={[{ key: "revenue", label: "Revenue" }]}
              height={250}
              formatValue={(v) => formatCurrency(v)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Top / Flop Articles */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Top 5 Articles (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No article data yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead className="text-right">Pageviews</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topArticles.map((article) => (
                    <TableRow key={article.article_id}>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs">
                        {article.article_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(article.pageviews)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(article.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(article.clicks)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Flop 5 Articles (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flopArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No article data yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead className="text-right">Pageviews</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flopArticles.map((article) => (
                    <TableRow key={article.article_id}>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs">
                        {article.article_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(article.pageviews)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(article.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(article.clicks)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Article Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Article Queue
            </CardTitle>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add to queue
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add to Queue</DialogTitle>
                </DialogHeader>
                <AddToQueueForm
                  siteId={site.id}
                  onSuccess={handleQueueAdded}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Queue is empty. Add keywords to generate articles.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={queue.map((q) => q.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {queue.map((item) => (
                    <SortableQueueItem key={item.id} item={item} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Social Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Recent Social Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {socialPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No social posts yet.
            </p>
          ) : (
            <div className="space-y-3">
              {socialPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="mt-0.5 text-muted-foreground">
                    {platformIcon(post.platform)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm">
                      {post.content || "No content"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        <span className="font-mono">
                          {formatNumber(post.likes)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointerClick className="h-3 w-3" />
                        <span className="font-mono">
                          {formatNumber(post.clicks)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="font-mono">
                          {formatNumber(post.reach)}
                        </span>
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={getStatusColor(post.status)}
                  >
                    {post.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
