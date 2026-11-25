-- Scolavis: KI-Kontingent pro Konto und Monat.
-- Einmal im Supabase-Dashboard ausführen (SQL Editor → einfügen → Run). Mehrfaches Ausführen schadet nicht.
--
-- Die Grenzen selbst stehen NICHT hier, sondern in wrangler.jsonc ("vars": KI_FRAGEN_EINFACH, KI_FRAGEN_PRO …).
-- Der Server (cloudflare/worker.js → kiQuota) ruft vor jeder KI-Frage ki_zaehlen() mit dem Anmelde-Token der
-- Lehrkraft auf. Gezählt wird nur eine Zahl pro Konto und Monat – keine Fragen, keine Inhalte.

create table if not exists public.ki_nutzung (
  user_id uuid    not null references auth.users(id) on delete cascade,
  monat   text    not null,                 -- 'JJJJ-MM' (deutsche Zeit)
  fragen  integer not null default 0,
  bilder  integer not null default 0,
  primary key (user_id, monat)
);

alter table public.ki_nutzung enable row level security;

-- Lesen darf jedes Konto nur die eigene Zeile. Schreiben geht ausschließlich über die Funktion unten.
drop policy if exists "ki_nutzung: nur eigenes Konto lesen" on public.ki_nutzung;
create policy "ki_nutzung: nur eigenes Konto lesen" on public.ki_nutzung
  for select to authenticated
  using (auth.uid() = user_id);

-- p_art: 'frage' | 'bild' zählt eins hoch (wenn noch Platz ist), alles andere liefert nur den Stand.
-- Tarif: app_metadata.plan aus dem Anmelde-Token ('pro'/'school' = Pro, sonst Einfach) – nur serverseitig setzbar.
-- Gesamt-Deckel: Summe aller Konten im Monat. Pro Konto zählen dabei höchstens 2000 Fragen / 4000 Bilder mit,
-- damit niemand durch direkte Aufrufe dieser Funktion den Deckel für alle aufbrauchen kann.
create or replace function public.ki_zaehlen(
  p_art text,
  p_fragen_einfach integer, p_fragen_pro integer,
  p_bilder_einfach integer, p_bilder_pro integer,
  p_gesamt_fragen integer,  p_gesamt_bilder integer
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_monat text := to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM');
  v_pro   boolean := coalesce(auth.jwt() -> 'app_metadata' ->> 'plan', '') in ('pro', 'school');
  v_lf    integer := case when v_pro then p_fragen_pro else p_fragen_einfach end;
  v_lb    integer := case when v_pro then p_bilder_pro else p_bilder_einfach end;
  v_row   public.ki_nutzung;
  v_sum   bigint;
  v_grund text := null;
begin
  if v_uid is null then
    raise exception 'nicht angemeldet' using errcode = '28000';
  end if;

  insert into public.ki_nutzung (user_id, monat) values (v_uid, v_monat) on conflict do nothing;
  select * into v_row from public.ki_nutzung where user_id = v_uid and monat = v_monat for update;

  if p_art = 'frage' then
    if v_row.fragen >= v_lf then
      v_grund := 'konto';
    else
      select coalesce(sum(least(n.fragen, 2000)), 0) into v_sum from public.ki_nutzung n where n.monat = v_monat;
      if v_sum >= p_gesamt_fragen then
        v_grund := 'gesamt';
      else
        update public.ki_nutzung set fragen = fragen + 1 where user_id = v_uid and monat = v_monat;
        v_row.fragen := v_row.fragen + 1;
      end if;
    end if;
  elsif p_art = 'bild' then
    if v_row.bilder >= v_lb then
      v_grund := 'konto';
    else
      select coalesce(sum(least(n.bilder, 4000)), 0) into v_sum from public.ki_nutzung n where n.monat = v_monat;
      if v_sum >= p_gesamt_bilder then
        v_grund := 'gesamt';
      else
        update public.ki_nutzung set bilder = bilder + 1 where user_id = v_uid and monat = v_monat;
        v_row.bilder := v_row.bilder + 1;
      end if;
    end if;
  end if;

  return json_build_object(
    'ok', v_grund is null, 'grund', v_grund,
    'plan', case when v_pro then 'pro' else 'einfach' end,
    'fragen', v_row.fragen, 'bilder', v_row.bilder,
    'limit_fragen', v_lf, 'limit_bilder', v_lb
  );
end $$;

revoke all on function public.ki_zaehlen(text, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.ki_zaehlen(text, integer, integer, integer, integer, integer, integer) to authenticated;

-- Überblick für den Betreiber (im SQL Editor ausführen): Verbrauch des laufenden Monats
-- select count(*) as konten, sum(fragen) as fragen, sum(bilder) as bilder
--   from public.ki_nutzung where monat = to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM');
