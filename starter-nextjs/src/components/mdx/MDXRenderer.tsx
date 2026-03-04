import { compileMDX } from "next-mdx-remote/rsc";
import { getMdxComponents } from "./mdx-components";

interface MDXRendererProps {
  source: string;
}

export async function MDXRenderer({ source }: MDXRendererProps) {
  try {
    const { content } = await compileMDX({
      source,
      components: getMdxComponents(),
      options: {
        parseFrontmatter: false,
      },
    });

    return <div className="prose">{content}</div>;
  } catch (error) {
    console.error("MDX render error:", error);
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">
          Erreur lors du rendu du contenu. Veuillez réessayer.
        </p>
      </div>
    );
  }
}
