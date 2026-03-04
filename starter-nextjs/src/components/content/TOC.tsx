interface TOCItem {
  id: string;
  text: string;
  level: 2 | 3;
}

interface TOCProps {
  source: string;
}

function extractHeadings(source: string): TOCItem[] {
  const headings: TOCItem[] = [];
  const regex = /^(#{2,3})\s+(.+)$/gm;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const level = match[1].length as 2 | 3;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "");
    headings.push({ id, text, level });
  }

  return headings;
}

export function TOC({ source }: TOCProps) {
  const headings = extractHeadings(source);

  if (headings.length < 2) return null;

  return (
    <nav className="sticky top-20">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Sommaire
      </h4>
      <ul className="space-y-1.5 border-l border-border pl-3">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={`block text-sm text-muted-foreground transition-colors hover:text-foreground ${
                heading.level === 3 ? "pl-3" : ""
              }`}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
