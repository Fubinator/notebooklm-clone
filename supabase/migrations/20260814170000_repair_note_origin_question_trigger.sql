-- The original create_notes migration was already applied to some environments
-- before its origin-question trigger was added. Install the trigger in a new
-- migration so those databases can derive the required value too.
create or replace function public.set_note_origin_question()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select questions.content
  into new.origin_question
  from public.messages answers
  join public.messages questions on questions.id = answers.reply_to_message_id
  where answers.id = new.origin_answer_id
    and answers.role = 'answer'
    and answers.status = 'completed'
    and questions.role = 'question';

  if new.origin_question is null then
    raise exception using errcode = '22023', message = 'invalid_note_origin';
  end if;

  return new;
end;
$$;

revoke all on function public.set_note_origin_question() from public, anon, authenticated;

drop trigger if exists notes_set_origin_question on public.notes;
create trigger notes_set_origin_question
before insert on public.notes
for each row execute function public.set_note_origin_question();
