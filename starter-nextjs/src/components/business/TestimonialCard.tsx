import { Card, CardContent } from "@/components/ui/card";

interface TestimonialCardProps {
  quote: string;
  author: string;
  role?: string;
  avatar?: string;
}

export function TestimonialCard({ quote, author, role }: TestimonialCardProps) {
  return (
    <Card className="my-4">
      <CardContent className="p-5">
        <blockquote className="text-sm italic text-muted-foreground">
          &ldquo;{quote}&rdquo;
        </blockquote>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
            {author.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium">{author}</p>
            {role && (
              <p className="text-xs text-muted-foreground">{role}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
