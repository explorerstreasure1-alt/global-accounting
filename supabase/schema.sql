-- ============================================================
-- Tailor Ledger — çok kiracılı SaaS şeması (Supabase SQL editor'e yapıştır)
-- Project: lwujklmjjoaubjbxaukn
-- 5 gün free trial + sonra kilit + işletme başına izole veri
-- ============================================================

-- 1) KULLANICI PROFİLİ (Supabase Auth ile birebir)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- 2) İŞLETMELER (her kayıt = bir kiracı = Canva'daki ayrı çalışma alanı gibi)
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Tailor Shop',
  locale text not null default 'en',
  currency text not null default 'USD',
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active',
  trial_ends_at timestamptz not null default (now() + interval '5 days'),
  lemon_customer_id text,
  lemon_subscription_id text,
  created_at timestamptz not null default now()
);
create index if not exists businesses_owner_idx on businesses(owner_id);

-- 3) DEFTER TABLOLARI (yoksa oluştur) + kiracı kolonu (mevcut tablolar korunur)
create table if not exists kayitlar (
  id uuid primary key default gen_random_uuid(),
  tarih date not null,
  aciklama text not null,
  kategori varchar(50) not null,
  gelir numeric(14,2) not null default 0,
  gider numeric(14,2) not null default 0,
  odeme_tipi varchar(20) not null,
  kasa_etkisi numeric(14,2) not null,
  olusturma_zamani timestamptz not null default now()
);

create table if not exists "sohbetMesajlari" (
  id uuid primary key default gen_random_uuid(),
  rol varchar(20) not null,
  icerik text not null,
  olusturma_zamani timestamptz not null default now()
);

create table if not exists ayarlar (
  id integer primary key generated always as identity,
  isletme_adi varchar(200) not null default 'My Tailor Shop',
  kira_tutari numeric(14,2) not null default 0,
  kira_periyodu integer not null default 6,
  aylik_kira_karsiligi numeric(14,2) not null default 0,
  para_birimi varchar(10) not null default 'USD',
  kira_sonraki_tarih date,
  acilis_bakiyesi numeric(14,2) not null default 0,
  ai_motor varchar(20) not null default 'otomatik',
  ollama_model varchar(100) not null default 'gemma3:4b',
  whatsapp_alici varchar(30) not null default ''
);

alter table kayitlar
  add column if not exists business_id uuid references businesses(id) on delete cascade;
alter table "sohbetMesajlari"
  add column if not exists business_id uuid references businesses(id) on delete cascade;

-- ayarlar: tek satır (id=1) modelinden işletme başına satıra geçiş
alter table ayarlar
  add column if not exists business_id uuid references businesses(id) on delete cascade;
create unique index if not exists ayarlar_business_uidx on ayarlar(business_id)
  where business_id is not null;

create index if not exists kayitlar_business_idx on kayitlar(business_id);
create index if not exists sohbet_business_idx on "sohbetMesajlari"(business_id);

-- 4) ERİŞİM FONKSİYONU: trial sürüyor mu / pro mu?
create or replace function can_use_app(b uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from businesses
    where id = b
      and owner_id = auth.uid()
      and (plan = 'pro' or trial_ends_at > now())
  );
$$;

-- 5) RLS: herkes SADECE kendi işletmesinin satırlarını görür
alter table profiles enable row level security;
alter table businesses enable row level security;
alter table kayitlar enable row level security;
alter table ayarlar enable row level security;
alter table "sohbetMesajlari" enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own businesses" on businesses;
create policy "own businesses" on businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "own kayitlar" on kayitlar;
create policy "own kayitlar" on kayitlar
  for all using (
    business_id is null or business_id in (select id from businesses where owner_id = auth.uid())
  ) with check (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

drop policy if exists "own ayarlar" on ayarlar;
create policy "own ayarlar" on ayarlar
  for all using (
    business_id is null or business_id in (select id from businesses where owner_id = auth.uid())
  ) with check (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

drop policy if exists "own sohbet" on "sohbetMesajlari";
create policy "own sohbet" on "sohbetMesajlari"
  for all using (
    business_id is null or business_id in (select id from businesses where owner_id = auth.uid())
  ) with check (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

-- 6) YENİ ÜYE: Auth kaydında otomatik profil + işletme + 5 günlük trial
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
as $$
declare
  b_id uuid;
begin
  insert into profiles(id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  insert into businesses(owner_id, name, trial_ends_at)
  values (new.id, 'My Tailor Shop', now() + interval '5 days')
  returning id into b_id;

  insert into ayarlar(isletme_adi, kira_tutari, kira_periyodu, aylik_kira_karsiligi, para_birimi, kira_sonraki_tarih, acilis_bakiyesi, ai_motor, ollama_model, whatsapp_alici, business_id)
  values ('My Tailor Shop', 1500, 6, 250, 'USD', null, 125, 'otomatik', 'gemma3:4b', '', b_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
