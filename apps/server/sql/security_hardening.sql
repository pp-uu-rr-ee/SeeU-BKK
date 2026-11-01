-- Security hardening (Supabase advisor fixes)
-- Run in: Supabase Dashboard > SQL Editor (or apply_migration "security_hardening")

-- Pin search_path on the updated_at trigger function so a caller cannot
-- shadow objects it references (advisor: function_search_path_mutable).
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- The `vector` extension intentionally stays in `public` (advisor: extension_in_public).
-- bangkok_unseen.embedding and match_places() depend on its types and operators;
-- moving it would require recreating those objects. Accepted risk.
