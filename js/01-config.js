'use strict';

// ══════════════════════════════════════════════════════════════
// SUPABASE KONFIGURATION
// Nach Supabase-Projekt anlegen hier eintragen:
//   1. Gehe auf https://supabase.com → Neues Projekt
//   2. Project Settings → API → Project URL + anon key kopieren
//   3. Führe das SQL-Setup im Supabase SQL-Editor aus (siehe unten)
// ══════════════════════════════════════════════════════════════
const SUPABASE_URL  = 'https://ubroujkwoizghiiustri.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_WbCKbSDkacYqUHxi0E6Qhg_-Lkau-i9';

/* SQL für Supabase SQL-Editor (einmalig ausführen):
──────────────────────────────────────────────────────
create table if not exists public.boards (
  user_id uuid primary key references auth.users on delete cascade,
  data    jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.boards enable row level security;
create policy "own" on public.boards for all using (auth.uid() = user_id);
──────────────────────────────────────────────────────
*/

// ══════════════════════════════════════════════════════════════
// AUTH MODULE
// ══════════════════════════════════════════════════════════════
