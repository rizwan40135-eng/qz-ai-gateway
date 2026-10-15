alter table public.entitlements add column exception boolean default false, add column spent_usd numeric default 0;
create table public.provider_secrets (provider_id text references public.providers(id) on delete cascade, slot text not null, secret text not null, created_at timestamptz default now(), primary key(provider_id, slot));
grant all on public.provider_secrets to service_role;
alter table public.provider_secrets enable row level security;
update public.models set provider_id='anthropic-direct' where id in ('m-claude-sonnet','m-claude-haiku');
update public.aliases set fallback_model='m-gpt-terra' where alias='qz-code';
update public.alias_versions set fallback_model='m-gpt-terra' where alias='qz-code';
update public.aliases set fallback_model='m-gemini-flash' where alias='qz-vision';