interface SchemaOrgProps {
  schema: Record<string, unknown>;
}

export function SchemaOrg({ schema }: SchemaOrgProps) {
  if (!schema || Object.keys(schema).length === 0) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
