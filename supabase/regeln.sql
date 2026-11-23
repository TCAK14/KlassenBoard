-- Scolavis – Zugriffsregeln (Row Level Security) für die Supabase-Datenbank
-- ─────────────────────────────────────────────────────────────────────────────
-- Einmal im Supabase-Dashboard ausführen: SQL Editor → neue Abfrage → alles einfügen → „Run".
-- Das Skript ist wiederholbar: es entfernt die vorhandenen Regeln dieser drei Tabellen und legt sie neu an.
-- Daten werden NICHT gelöscht oder verändert.
--
-- Stand der Prüfung von außen (23.11.2026, ohne Anmeldung, mit dem öffentlichen Schlüssel):
--   boards      → nichts lesbar (gut)
--   polls       → alle Umfragen lesbar (nötig, damit Schüler per Link abstimmen können)
--   poll_votes  → alle Stimmen lesbar (ohne Namen); ob Fremde Stimmen/Umfragen LÖSCHEN oder ÄNDERN können,
--                 ließ sich von außen nicht prüfen → dieses Skript stellt es sicher.
--   class_boards→ Tabelle existiert nicht (der Code versucht sie zu benutzen und fällt auf den lokalen Stand zurück)
--
-- Regeln danach:
--   boards      nur das eigene Konto liest/schreibt seine Tafeln
--   polls       jeder darf lesen (Abstimm-Link); anlegen/ändern/löschen nur das eigene Konto
--   poll_votes  jeder darf lesen und für eine laufende Umfrage abstimmen; löschen nur, wem die Umfrage gehört

-- 1) vorhandene Regeln dieser Tabellen entfernen (Namen sind nicht bekannt)
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('boards', 'polls', 'poll_votes')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2) Regeln einschalten
alter table public.boards     enable row level security;
alter table public.polls      enable row level security;
alter table public.poll_votes enable row level security;

-- 3) Tafeln: nur das eigene Konto
create policy "boards: nur eigenes Konto" on public.boards
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4) Umfragen
create policy "polls: jeder darf lesen" on public.polls
  for select to anon, authenticated
  using (true);
create policy "polls: anlegen nur eigenes Konto" on public.polls
  for insert to authenticated
  with check (auth.uid() = user_id);
create policy "polls: aendern nur eigenes Konto" on public.polls
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "polls: loeschen nur eigenes Konto" on public.polls
  for delete to authenticated
  using (auth.uid() = user_id);

-- 5) Stimmen
create policy "poll_votes: jeder darf lesen" on public.poll_votes
  for select to anon, authenticated
  using (true);
create policy "poll_votes: abstimmen bei laufender Umfrage" on public.poll_votes
  for insert to anon, authenticated
  with check (
    option_index between 0 and 9
    and exists (select 1 from public.polls p where p.id = poll_votes.poll_id and p.active)
  );
create policy "poll_votes: loeschen nur Besitzer der Umfrage" on public.poll_votes
  for delete to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_votes.poll_id and p.user_id = auth.uid()));

-- 6) Kontrolle: zeigt die Regeln, die jetzt gelten
select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename in ('boards', 'polls', 'poll_votes')
order by tablename, cmd;
