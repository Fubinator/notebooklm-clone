-- Grounded Answering is orchestrated by the Next.js server. Guest JWTs must
-- not be able to manufacture Retrieval evidence or completed Answers through
-- PostgREST. Service-role wrappers establish the already-authenticated Guest
-- identity for the existing invariant-owning functions.

revoke all on function public.begin_question(uuid, text, uuid) from authenticated, service_role;
revoke all on function public.retrieve_passages(uuid, extensions.vector, integer, double precision) from authenticated, service_role;
revoke all on function public.set_question_evidence(uuid, uuid[]) from authenticated, service_role;
revoke all on function public.complete_answer(uuid, text, text, text, text, uuid[]) from authenticated, service_role;
revoke all on function public.fail_answer(uuid) from authenticated, service_role;

create or replace function public.begin_grounded_question(
  target_guest_id uuid,
  target_notebook_id uuid,
  question_content text,
  request_correlation_id uuid
)
returns table (conversation_id uuid, question_id uuid, answer_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_guest_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  perform set_config('request.jwt.claim.sub', target_guest_id::text, true);
  return query select * from public.begin_question(
    target_notebook_id,
    question_content,
    request_correlation_id
  );
end;
$$;

create or replace function public.retrieve_grounded_passages(
  target_guest_id uuid,
  target_notebook_id uuid,
  question_embedding extensions.vector(384),
  match_count integer default 5,
  minimum_similarity double precision default 0.42
)
returns table (
  passage_id uuid,
  source_id uuid,
  source_title text,
  source_kind text,
  content text,
  page_number integer,
  paragraph_start integer,
  paragraph_end integer,
  similarity double precision
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_guest_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  perform set_config('request.jwt.claim.sub', target_guest_id::text, true);
  return query select * from public.retrieve_passages(
    target_notebook_id,
    question_embedding,
    match_count,
    minimum_similarity
  );
end;
$$;

create or replace function public.record_grounded_evidence(
  target_guest_id uuid,
  target_question_id uuid,
  evidence_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_guest_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  perform set_config('request.jwt.claim.sub', target_guest_id::text, true);
  perform public.set_question_evidence(target_question_id, evidence_ids);
end;
$$;

create or replace function public.complete_grounded_answer(
  target_guest_id uuid,
  target_answer_id uuid,
  answer_content text,
  completion_kind text,
  completion_provider text,
  completion_model text,
  cited_passage_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_guest_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  perform set_config('request.jwt.claim.sub', target_guest_id::text, true);
  perform public.complete_answer(
    target_answer_id,
    answer_content,
    completion_kind,
    completion_provider,
    completion_model,
    cited_passage_ids
  );
end;
$$;

create or replace function public.fail_grounded_answer(
  target_guest_id uuid,
  target_answer_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_guest_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  perform set_config('request.jwt.claim.sub', target_guest_id::text, true);
  perform public.fail_answer(target_answer_id);
end;
$$;

revoke all on function public.begin_grounded_question(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.retrieve_grounded_passages(uuid, uuid, extensions.vector, integer, double precision) from public, anon, authenticated;
revoke all on function public.record_grounded_evidence(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.complete_grounded_answer(uuid, uuid, text, text, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.fail_grounded_answer(uuid, uuid) from public, anon, authenticated;

grant execute on function public.begin_grounded_question(uuid, uuid, text, uuid) to service_role;
grant execute on function public.retrieve_grounded_passages(uuid, uuid, extensions.vector, integer, double precision) to service_role;
grant execute on function public.record_grounded_evidence(uuid, uuid, uuid[]) to service_role;
grant execute on function public.complete_grounded_answer(uuid, uuid, text, text, text, text, uuid[]) to service_role;
grant execute on function public.fail_grounded_answer(uuid, uuid) to service_role;
