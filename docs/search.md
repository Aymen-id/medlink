# Workspace search

Document names are normalized with PostgreSQL unaccent and lowercase in an always-running trigger. A generated simple-language tsvector has a GIN index; a second GIN trigram index supports the partial-name LIKE fallback. The RPC matches full tokens or literal substrings, normalizes the query identically, escapes LIKE wildcards, and returns one next-page sentinel beyond the requested page.

The RPC runs as SECURITY INVOKER. It filters the selected workspace and still obeys patient/file RLS; passing another workspace UUID does not grant access. Patient-name searches use quoted PostgREST filter values and independent bounded pages. Document links retain folderId, including nested folders.

Short substring queries can require a workspace-scoped scan because fewer than three characters offer few trigrams. Result pages are at most 100 plus one sentinel (the application uses 20); page numbers are bounded at 100000. Query failures are visible and never converted into a silent empty success or an unscoped fallback. PostgreSQL planner/latency measurements at production scale remain a hosted gate.

Reference: https://supabase.com/docs/guides/database/full-text-search .
