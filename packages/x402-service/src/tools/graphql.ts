export async function handleGraphql(args: {
  query: string;
  variables?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const ponderUrl = process.env.PONDER_URL || "http://localhost:42069";
  const res = await fetch(ponderUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: args.query,
      variables: args.variables,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ponder GraphQL error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as Record<string, unknown>;
}
