-- Structured data behind an assistant reply (the UI payload: summary, trip draft,
-- suggested places) so a reopened chat can show its trip card again.
-- `content` stays plain text because it is replayed to the LLM as history.
-- Additive only: existing messages keep metadata = NULL.

ALTER TABLE agent_messages
    ADD COLUMN IF NOT EXISTS metadata JSONB;
