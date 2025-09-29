
-- Create extension (if not already present)
create extension if not exists vector;

-- patient_documents table
create table if not exists patient_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null,
  doc_id text,
  chunk_id int,
  text text,
  metadata jsonb default '{}'::jsonb,
  embedding vector(1024),
  created_at timestamptz default now()
);

-- Optional: index for faster approximate search (tune lists value)
create index if not exists idx_patient_documents_embedding on patient_documents using ivfflat (embedding) with (lists = 100);

-- RPC function to match by patient_id
create or replace function match_patient_documents(
  query_embedding vector(1024),
  match_count int,
  patientid text
)
returns table(id uuid, patient_id text, doc_id text, chunk_id int, text text, metadata jsonb, score float)
language sql stable as $$
  select id, patient_id, doc_id, chunk_id, text, metadata,
         1 - (patient_documents.embedding <=> query_embedding) as score
  from patient_documents
  where patient_id = patientid
  order by patient_documents.embedding <=> query_embedding
  limit match_count;
$$;

