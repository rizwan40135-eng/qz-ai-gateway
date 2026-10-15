create table public.user_roles (user_id text not null, role text not null, primary key(user_id, role));
create table public.app_users (id text primary key, email text, display_name text, team text default 'Engineering', business_unit text default 'Technology', created_at timestamptz default now());
create table public.projects (id uuid primary key default gen_random_uuid(), name text not null, team text not null, business_unit text not null, owner_id text, owner_name text, environment text not null, use_case text, data_class text not null, expected_requests int default 0, expected_tokens bigint default 0, cost_center text, app_name text, description text, status text default 'active', budget_usd numeric default 1000, spent_usd numeric default 0, seeded boolean default false, created_at timestamptz default now());
create table public.access_requests (id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id) on delete cascade, requester_id text, requester_name text, team text, business_unit text, kind text default 'Model Access', alias text not null, use_case text, environment text, data_class text, expected_tokens bigint default 0, expected_spend numeric default 0, duration_days int default 90, justification text, preflight jsonb, outcome text, status text default 'pending', conditions jsonb, decided_by text, decided_at timestamptz, note text, created_at timestamptz default now());
create table public.entitlements (id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id) on delete cascade, alias text not null, environment text not null, max_class text not null, monthly_budget numeric default 500, rpm int default 100, tpm int default 100000, expires_at timestamptz, logging text default 'METADATA ONLY', endpoints text[] default array['responses','chat','messages','embeddings','models'], status text default 'active', request_id uuid, created_at timestamptz default now());
create table public.gateway_keys (id uuid primary key default gen_random_uuid(), name text not null, prefix text not null, last4 text not null, key_hash text unique, project_id uuid references public.projects(id) on delete cascade, owner_id text, owner_name text, kind text default 'human', environment text, aliases text[] default '{}', scopes text[] default '{}', budget numeric default 500, rpm int default 100, expires_at timestamptz, status text default 'active', requests bigint default 0, tokens bigint default 0, spend numeric default 0, last_used timestamptz, rpm_window_start timestamptz, rpm_count int default 0, created_at timestamptz default now());
create table public.providers (id text primary key, name text not null, kind text not null, base_url text, auth text, region text, status text default 'enabled', external boolean default true, restricted_ok boolean default false, simulated_outage boolean default false, secret_last4 text, secret_status text default 'none', pending_secret_last4 text, secret_rotated_at timestamptz, latency_ms int default 900, error_rate numeric default 0.4);
create table public.models (id text primary key, provider_id text references public.providers(id), provider_model text not null, capabilities text[] default '{}', max_class text default 'INTERNAL', region text, context_window int, vision boolean default false, streaming boolean default true, tools boolean default true, structured boolean default true, input_price numeric default 1, output_price numeric default 4, cached_price numeric default 0.1, status text default 'Approved', latency_ms int default 900, error_rate numeric default 0.3);
create table public.aliases (alias text primary key, purpose text, version int default 1, strategy text default 'Primary + Fallback', primary_model text references public.models(id), fallback_model text references public.models(id), environments text[] default array['Sandbox','Development','Test','Production'], max_class text default 'CONFIDENTIAL', latency_ms int default 4000, retries int default 1, status text default 'Approved', updated_at timestamptz default now());
create table public.alias_versions (id uuid primary key default gen_random_uuid(), alias text references public.aliases(alias) on delete cascade, version int, primary_model text, fallback_model text, strategy text, note text, status text default 'active', created_by text, created_at timestamptz default now());
create table public.matrix (team text, alias text, environment text, state text not null, primary key(team, alias, environment));
create table public.governance (team text primary key, environment text, data_class text, aliases text, budget_usd numeric, rpm int, tpm int, logging text, key_expiry_days int, spent_usd numeric default 0, enforcement text default 'Alert');
create table public.policies (id text primary key, name text not null, layer text not null, description text, condition jsonb, action text not null, enabled boolean default true, origin text default 'Organization', updated_at timestamptz default now());
create table public.traces (id text primary key, created_at timestamptz default now(), user_name text, team text, project_name text, key_prefix text, alias text, provider text, model text, endpoint text, environment text, input_tokens int default 0, output_tokens int default 0, cost numeric default 0, latency_ms int default 0, ttft_ms int default 0, status int default 200, error_code text, policy_id text, policy_result text default 'PASS', fallback boolean default false, simulated boolean default false, usage_estimated boolean default false, logging text, steps jsonb, request_preview text, response_preview text);
create table public.audit_events (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), actor text, action text, resource text, prev_value text, new_value text, reason text, approval text, request_id text);
create table public.alerts (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), type text, severity text, title text, detail text, status text default 'open', assignee text, snoozed_until timestamptz);
create table public.eval_sets (id uuid primary key default gen_random_uuid(), name text, category text, owner text, project text, prompts jsonb, criteria text, last_run jsonb, created_at timestamptz default now());
create table public.pricing (id uuid primary key default gen_random_uuid(), provider text, model text, input_price numeric, output_price numeric, cached_price numeric, unit text default 'per 1M tokens', currency text default 'USD', effective_from date default '2026-01-01', effective_to date);

do $$ declare t text; begin
 foreach t in array array['user_roles','app_users','projects','access_requests','entitlements','gateway_keys','providers','models','aliases','alias_versions','matrix','governance','policies','traces','audit_events','alerts','eval_sets','pricing'] loop
  execute format('grant all on public.%I to service_role', t);
  execute format('alter table public.%I enable row level security', t);
 end loop; end $$;

insert into public.providers(id,name,kind,base_url,auth,region,external,restricted_ok,secret_last4,secret_status,latency_ms,error_rate) values
('lovable-ai','Lovable AI (multi-model)','OpenAI-compatible','https://ai.gateway.lovable.dev/v1','Managed bearer (server-side)','us-east',true,false,'••7Q2D','active',1100,0.3),
('azure-eu','Azure-hosted EU Endpoint','Azure OpenAI','https://nova-eu.openai.azure.example/v1','API key header','eu-west',false,true,null,'none',1300,0.2),
('anthropic-direct','Anthropic','Anthropic','https://api.anthropic.com/v1','x-api-key','us-west',true,false,null,'none',1200,0.4),
('openai-direct','OpenAI','OpenAI','https://api.openai.com/v1','Bearer','us-east',true,false,null,'none',1000,0.5),
('demo','Demo Provider (Simulated)','Deterministic simulator','internal://demo','None','local',false,true,null,'n/a',380,0);

insert into public.models(id,provider_id,provider_model,capabilities,max_class,region,context_window,vision,input_price,output_price,cached_price,status,latency_ms,error_rate) values
('m-gemini-lite','lovable-ai','google/gemini-3.1-flash-lite','{chat,extraction}','CONFIDENTIAL','us-east',1000000,true,0.10,0.40,0.03,'Approved',620,0.2),
('m-gemini-flash','lovable-ai','google/gemini-3-flash-preview','{chat,code,reasoning}','CONFIDENTIAL','us-east',1000000,true,0.30,2.50,0.08,'Approved',950,0.3),
('m-gemini-pro','lovable-ai','google/gemini-3.1-pro-preview','{reasoning,code,vision}','CONFIDENTIAL','us-east',1000000,true,1.25,10.00,0.31,'Approved',2400,0.5),
('m-gpt-luna','lovable-ai','openai/gpt-5.6-luna','{chat,extraction}','CONFIDENTIAL','us-east',400000,false,0.05,0.40,0.01,'Approved',700,0.3),
('m-gpt-terra','lovable-ai','openai/gpt-5.6-terra','{chat,code,reasoning}','CONFIDENTIAL','us-east',400000,true,0.25,2.00,0.03,'Approved',1200,0.3),
('m-gpt-sol','lovable-ai','openai/gpt-5.6-sol','{reasoning,code}','CONFIDENTIAL','us-east',400000,true,1.25,10.00,0.13,'Under Review',2900,0.6),
('m-claude-sonnet','lovable-ai','anthropic/claude-sonnet-5','{code,reasoning,chat}','CONFIDENTIAL','us-west',200000,true,3.00,15.00,0.30,'Approved',1500,0.4),
('m-claude-haiku','lovable-ai','anthropic/claude-haiku-4-5','{chat,code}','INTERNAL','us-west',200000,true,1.00,5.00,0.10,'Approved',800,0.3),
('m-embed','lovable-ai','google/gemini-embedding-2','{embedding}','CONFIDENTIAL','us-east',8000,false,0.15,0,0,'Approved',180,0.1),
('m-azure-gpt','azure-eu','nova-eu-gpt-deployment','{chat,reasoning}','RESTRICTED','eu-west',128000,false,0.40,1.60,0.10,'Restricted',1400,0.2),
('m-demo-chat','demo','demo-sim-chat-1','{chat,code,reasoning}','RESTRICTED','local',32000,false,0,0,0,'Approved',380,0),
('m-legacy','openai-direct','legacy-model-2024','{chat}','INTERNAL','us-east',16000,false,0.50,1.50,0,'Deprecated',1800,1.2);

insert into public.pricing(provider,model,input_price,output_price,cached_price) select provider_id, provider_model, input_price, output_price, cached_price from public.models;

insert into public.aliases(alias,purpose,primary_model,fallback_model,strategy,max_class,latency_ms) values
('qz-fast','Low-latency chat, classification and extraction','m-gemini-lite','m-gpt-luna','Primary + Fallback','CONFIDENTIAL',2500),
('qz-balanced','General-purpose assistant workloads','m-gpt-terra','m-gemini-flash','Primary + Fallback','CONFIDENTIAL',4000),
('qz-reasoning','Multi-step analysis and planning','m-gemini-pro','m-gpt-terra','Primary + Fallback','CONFIDENTIAL',9000),
('qz-code','Code generation, review and coding assistants','m-gemini-flash','m-claude-haiku','Primary + Fallback','INTERNAL',5000),
('qz-vision','Image and document understanding','m-gemini-flash','m-gpt-terra','Capability-Based','CONFIDENTIAL',6000),
('qz-embedding','Semantic search and retrieval embeddings','m-embed',null,'Fixed','CONFIDENTIAL',1500);
insert into public.alias_versions(alias,version,primary_model,fallback_model,strategy,note,created_by) select alias,1,primary_model,fallback_model,strategy,'Initial approved route','AI Platform Admin' from public.aliases;

insert into public.matrix(team,alias,environment,state)
select t, a, '*', case
 when t='Engineering' and a in ('qz-fast','qz-code','qz-reasoning','qz-embedding','qz-balanced') then 'ALLOWED'
 when t='Finance' and a in ('qz-fast','qz-balanced','qz-reasoning') then 'ALLOWED'
 when t='Analytics' then 'ALLOWED'
 when t='HR' and a='qz-fast' then 'ALLOWED'
 when t='HR' then 'DENIED'
 when a='qz-vision' then 'APPROVAL REQUIRED'
 when a in ('qz-fast','qz-balanced','qz-embedding') then 'ALLOWED'
 else 'APPROVAL REQUIRED' end
from unnest(array['Engineering','Finance','Analytics','Commercial','Supply Chain','Research','HR']) t, unnest(array['qz-fast','qz-balanced','qz-reasoning','qz-code','qz-vision','qz-embedding']) a;

insert into public.governance values
('Engineering','Development','INTERNAL','qz-fast, qz-code, qz-reasoning',20000,600,800000,'METADATA ONLY',90,12400,'Alert'),
('Finance','Production','CONFIDENTIAL','qz-fast, qz-balanced',8000,300,400000,'NO CONTENT RETENTION',60,4100,'Approval Required'),
('Analytics','Development','INTERNAL','all approved',12000,500,600000,'REDACTED CONTENT',90,10950,'Recommend Lower-Cost Alias'),
('HR','Production','RESTRICTED','qz-fast only',3000,60,100000,'NO CONTENT RETENTION',30,820,'Block'),
('Commercial','Production','CONFIDENTIAL','qz-fast, qz-balanced, qz-embedding',9000,300,400000,'METADATA ONLY',60,7350,'Throttle'),
('Supply Chain','Test','INTERNAL','qz-fast, qz-balanced, qz-reasoning',6000,200,300000,'METADATA ONLY',90,2600,'Alert'),
('Research','Sandbox','PUBLIC','all approved',7000,300,500000,'FULL CONTENT',90,3900,'Alert');

insert into public.policies(id,name,layer,description,condition,action,origin) values
('SEC-001','Valid Q-GATE key required','Identity','Every request must present an active, unexpired Q-GATE key','{"field":"key.status","op":"!=","value":"active"}','BLOCK','Organization'),
('ENT-002','Alias entitlement required','Entitlement','Project must hold an active entitlement for the requested alias','{"field":"entitlement","op":"=","value":"missing"}','BLOCK','Organization'),
('ENV-003','Production requires approved entitlement','Environment','Production traffic only for entitlements scoped to Production','{"field":"environment","op":"=","value":"Production"}','REQUIRE APPROVAL','Organization'),
('DATA-004','Restricted data stays on approved endpoints','Data Classification','Restricted data may only reach providers approved for Restricted','{"all":[{"field":"classification","op":"=","value":"RESTRICTED"},{"field":"provider.external","op":"=","value":"true"}]}','BLOCK','Organization'),
('DLP-005','Email address detection','Content','DEMO POLICY DETECTION: email addresses','{"detector":"email"}','REDACT','Organization'),
('DLP-006','Phone number detection','Content','DEMO POLICY DETECTION: phone numbers','{"detector":"phone"}','REDACT','Organization'),
('DLP-007','Credit card pattern','Content','DEMO POLICY DETECTION: 13-16 digit card patterns','{"detector":"card"}','BLOCK','Organization'),
('DLP-008','Government ID pattern','Content','DEMO POLICY DETECTION: SSN-style identifiers','{"detector":"govid"}','BLOCK','Organization'),
('DLP-009','Customer ID pattern','Content','DEMO POLICY DETECTION: CUST-000000 identifiers','{"detector":"customer"}','REDACT','Business Unit'),
('DLP-010','Custom keywords','Content','DEMO POLICY DETECTION: Project Falcon, merger target','{"detector":"keywords","keywords":["project falcon","merger target"]}','REQUIRE APPROVAL','Business Unit'),
('SEC-011','Private key header','Content','Detects -----BEGIN PRIVATE KEY----- blocks','{"detector":"privatekey"}','BLOCK','Organization'),
('SEC-012','Connection strings','Content','Detects postgres:// mongodb:// Server= strings','{"detector":"connstring"}','BLOCK','Organization'),
('SEC-013','Password assignment','Content','Detects password= literals','{"detector":"password"}','BLOCK','Organization'),
('SEC-014','API key / secret leak protection','Content','Detects sk-..., qzg_... and similar secrets','{"detector":"apikey"}','BLOCK','Organization'),
('BUD-015','Budget critical threshold','Budget','At >= 90% of monthly budget apply team enforcement','{"field":"budget.pct","op":">=","value":90}','REQUIRE FINOPS APPROVAL','Organization'),
('BUD-016','Budget exhausted','Budget','At 100% block unless exception','{"field":"budget.pct","op":">=","value":100}','BLOCK','Organization'),
('RATE-017','Key requests per minute','Rate Limit','Enforce key RPM','{"field":"key.rpm","op":">","value":"limit"}','BLOCK','Team'),
('REG-018','EU data residency','Region','EU-tagged projects route to eu-west only','{"field":"project.region","op":"=","value":"EU"}','BLOCK','Business Unit'),
('LOG-019','Restricted projects log no content','Logging','Restricted classification forces NO CONTENT RETENTION','{"field":"classification","op":"=","value":"RESTRICTED"}','ALLOW','Organization'),
('TOOL-020','Code execution tools','Tool Access','Agent code execution requires approval','{"tool":"code_execution"}','REQUIRE APPROVAL','Organization'),
('TOOL-021','External network actions','Tool Access','Agents may not call arbitrary network endpoints','{"tool":"network"}','BLOCK','Organization'),
('TOOL-022','File access tools','Tool Access','File read tools allowed in Development','{"tool":"file_access"}','ALLOW','Team'),
('MOD-023','Deprecated models not routable','Model','Deprecated or disabled models cannot be selected','{"field":"model.status","op":"in","value":["Deprecated","Disabled"]}','BLOCK','Organization'),
('MOD-024','Under-review models sandbox only','Model','Under Review models only in Sandbox','{"field":"model.status","op":"=","value":"Under Review"}','BLOCK','Organization');

insert into public.projects(name,team,business_unit,owner_name,environment,use_case,data_class,expected_requests,expected_tokens,cost_center,app_name,budget_usd,spent_usd,seeded)
select (array['Code Review Bot','Finance Copilot','Customer Insights','Demand Forecast','Doc Processor','Contract Analyzer','Sales Email Assist','Supplier Risk','Research Summaries','HR Policy Q&A','Pricing Engine','Churn Explainer','Ticket Triage','Spend Classifier','Lab Notes Search','Release Notes Gen','Fraud Narratives','Inventory Agent','Market Scanner','Onboarding Guide','Test Generator','KPI Narrator','Quote Builder','Logistics Planner','Benefits Assistant'])[i],
 (array['Engineering','Finance','Analytics','Supply Chain','Engineering','Finance','Commercial','Supply Chain','Research','HR','Commercial','Analytics','Engineering','Finance','Research','Engineering','Finance','Supply Chain','Commercial','HR','Engineering','Analytics','Commercial','Supply Chain','HR'])[i],
 (array['Technology','Finance','Analytics','Supply Chain','Technology','Finance','Commercial','Supply Chain','Research','HR','Commercial','Analytics','Technology','Finance','Research','Technology','Finance','Supply Chain','Commercial','HR','Technology','Analytics','Commercial','Supply Chain','HR'])[i],
 (array['Priya Raman','Daniel Okafor','Mei Chen','Lucas Brandt','Aisha Khan','Tom Wright','Sofia Rossi','Kenji Sato','Elena Petrova','Grace Liu'])[1+(i%10)],
 (array['Development','Production','Production','Test','Production','Production','Development','Test','Sandbox','Production'])[1+(i%10)],
 'Enterprise assistant', (array['INTERNAL','CONFIDENTIAL','INTERNAL','INTERNAL','CONFIDENTIAL','RESTRICTED','PUBLIC'])[1+(i%7)],
 20000+i*3100, 4000000+i*610000, 'CC-'||(4100+i), 'app-'||i, 1000+(i%5)*1500, (1000+(i%5)*1500)*((30+(i*7)%68)/100.0), true
from generate_series(1,25) i;

insert into public.gateway_keys(name,prefix,last4,project_id,owner_name,kind,environment,aliases,scopes,budget,rpm,expires_at,status,requests,tokens,spend,last_used,created_at)
select 'key-'||lpad(i::text,3,'0'), case when i%4=0 then 'qzg_test_' else 'qzg_live_' end,
 upper(substr(md5('k'||i),1,4)), (select id from public.projects where seeded order by name offset (i%25) limit 1),
 (array['Priya Raman','Daniel Okafor','Mei Chen','Lucas Brandt','Aisha Khan','svc-finance-copilot','svc-forecast-agent','svc-doc-processor'])[1+(i%8)],
 case when i%8>=5 then 'service' else 'human' end,
 (array['Development','Production','Test','Sandbox'])[1+(i%4)],
 (array[array['qz-fast','qz-code'],array['qz-fast','qz-balanced'],array['qz-reasoning','qz-fast'],array['qz-embedding','qz-fast']])[1+(i%4):1+(i%4)],
 array['responses:write','chat:write','models:read'], 200+(i%6)*150, 60+(i%5)*40, timestamptz '2026-10-14' + ((i%120)-20)*interval '1 day',
 case when i%23=0 then 'revoked' when i%17=0 then 'disabled' else 'active' end,
 (i*977)%42000, (i*7919)%9000000, ((i*131)%2400)/1.0, timestamptz '2026-10-14' - ((i*7)%95)*interval '1 day', timestamptz '2026-03-01' + (i%180)*interval '1 day'
from generate_series(1,184) i;

insert into public.traces(id,created_at,user_name,team,project_name,key_prefix,alias,provider,model,endpoint,environment,input_tokens,output_tokens,cost,latency_ms,ttft_ms,status,error_code,policy_id,policy_result,fallback,simulated,logging)
select 'qgr_'||substr(md5('t'||i),1,16), timestamptz '2026-10-14 14:00' - (i*11)*interval '1 minute',
 (array['Priya Raman','Daniel Okafor','Mei Chen','Lucas Brandt','Aisha Khan','svc-finance-copilot','svc-forecast-agent','Grace Liu'])[1+(i%8)],
 (array['Engineering','Finance','Analytics','Supply Chain','Engineering','Finance','Supply Chain','HR'])[1+(i%8)],
 (array['Developer Productivity','Finance Copilot','Customer Insights','Demand Forecast','Code Review Bot','Contract Analyzer','Inventory Agent','HR Policy Q&A'])[1+(i%8)],
 'qzg_live_••••'||upper(substr(md5('k'||(i%184)),1,4)),
 (array['qz-code','qz-balanced','qz-reasoning','qz-fast','qz-code','qz-embedding','qz-fast','qz-fast'])[1+(i%8)],
 case when i%29=0 then 'Lovable AI (fallback)' else 'Lovable AI (multi-model)' end,
 (array['google/gemini-3-flash-preview','openai/gpt-5.6-terra','google/gemini-3.1-pro-preview','google/gemini-3.1-flash-lite','google/gemini-3-flash-preview','google/gemini-embedding-2','google/gemini-3.1-flash-lite','google/gemini-3.1-flash-lite'])[1+(i%8)],
 (array['/v1/responses','/v1/chat/completions','/v1/messages','/v1/chat/completions','/v1/responses','/v1/embeddings','/v1/chat/completions','/v1/chat/completions'])[1+(i%8)],
 (array['Development','Production','Production','Test','Production','Production','Test','Production'])[1+(i%8)],
 200+(i*37)%3800, case when i%8=5 then 0 else 80+(i*53)%1400 end,
 ((200+(i*37)%3800)*0.3 + (80+(i*53)%1400)*2.5)/1000000.0 * (1+(i%3)),
 400+(i*97)%2600, 180+(i*41)%700,
 case when i%41=0 then 403 when i%53=0 then 429 when i%61=0 then 502 when i%71=0 then 402 else 200 end,
 case when i%41=0 then 'policy_blocked' when i%53=0 then 'rate_limit_exceeded' when i%61=0 then 'provider_unavailable' when i%71=0 then 'budget_exceeded' else null end,
 case when i%41=0 then 'DATA-004' when i%53=0 then 'RATE-017' when i%71=0 then 'BUD-016' else null end,
 case when i%41=0 or i%53=0 or i%71=0 then 'BLOCKED' when i%13=0 then 'REDACTED' else 'PASS' end,
 i%29=0, false,
 (array['METADATA ONLY','NO CONTENT RETENTION','REDACTED CONTENT','METADATA ONLY'])[1+(i%4)]
from generate_series(1,500) i;

insert into public.alerts(created_at,type,severity,title,detail,status)
select timestamptz '2026-10-14 14:00' - (i*47)*interval '1 minute',
 (array['Spend Spike','Budget Threshold','Error Spike','Latency Spike','Provider Outage','Policy Violation','Key Security','Model Deprecation','Unexpected Traffic','Budget Threshold'])[1+(i%10)],
 (array['high','medium','critical','medium','critical','high','high','low','medium','high'])[1+(i%10)],
 (array['Spend up 38% for Analytics','Analytics at 91% of monthly budget','Provider 5xx rate 4.2% on qz-reasoning','qz-code P95 crossed 5s threshold','Primary route outage detected','Restricted data blocked in production','Key unused 60+ days still active','legacy-model-2024 deprecation in 30 days','Off-hours traffic spike from svc-forecast-agent','Commercial at 82% of monthly budget'])[1+(i%10)] || ' #' || i,
 'Generated by Q-GATE monitoring rule', case when i%5=0 then 'acknowledged' when i%7=0 then 'resolved' else 'open' end
from generate_series(1,30) i;

insert into public.audit_events(created_at,actor,action,resource,prev_value,new_value,reason,request_id)
select timestamptz '2026-10-14 14:00' - (i*29)*interval '1 minute',
 (array['Nadia Haddad (AI Platform Admin)','Omar Velez (Security Admin)','Ruth Klein (FinOps Admin)','Priya Raman (Developer)','system'])[1+(i%5)],
 (array['Key Created','Key Rotated','Key Revoked','Alias Changed','Model Approved','Provider Disabled','Budget Changed','Policy Updated','Access Granted','Request Blocked'])[1+(i%10)],
 (array['key-0'||lpad((i%99)::text,2,'0'),'alias:qz-code','policy:DLP-007','budget:Analytics','provider:openai-direct'])[1+(i%5)],
 (array['active','v1','REDACT','$10,000','enabled'])[1+(i%5)], (array['rotated','v2','BLOCK','$12,000','disabled'])[1+(i%5)],
 'Change ticket CHG-'||(8000+i), case when i%10=9 then 'qgr_'||substr(md5('t'||i),1,16) else null end
from generate_series(1,100) i;

insert into public.access_requests(requester_name,team,business_unit,kind,alias,use_case,environment,data_class,expected_tokens,expected_spend,duration_days,justification,outcome,status,project_id,created_at)
select (array['Mei Chen','Daniel Okafor','Lucas Brandt','Sofia Rossi','Kenji Sato'])[1+(i%5)],
 (array['Analytics','Finance','Supply Chain','Commercial','Research'])[1+(i%5)],
 (array['Analytics','Finance','Supply Chain','Commercial','Research'])[1+(i%5)],
 (array['Model Access','Production Access','Restricted Data Access','Budget Increase','Temporary Entitlement','Policy Exception','Provider Enablement'])[1+(i%7)],
 (array['qz-reasoning','qz-vision','qz-code','qz-balanced','qz-reasoning'])[1+(i%5)], 'Business workflow automation',
 (array['Production','Development','Production','Test'])[1+(i%4)], (array['INTERNAL','CONFIDENTIAL','RESTRICTED'])[1+(i%3)],
 2000000+i*150000, 120+i*35, 90, 'Seeded request '||i,
 (array['ADMIN APPROVAL REQUIRED','SECURITY REVIEW REQUIRED','ADMIN APPROVAL REQUIRED'])[1+(i%3)],
 case when i<=14 then 'pending' when i%2=0 then 'approved' else 'rejected' end,
 (select id from public.projects where seeded order by name offset (i%25) limit 1),
 timestamptz '2026-10-14' - i*interval '7 hours'
from generate_series(1,25) i;

insert into public.eval_sets(name,category,owner,project,prompts,criteria)
select (array['Python bug review','SQL generation','Exec summary','Earnings call digest','Invoice extraction','Contract clause JSON','Policy Q&A','Product FAQ','Refactor suggestions','Incident summary'])[i],
 (array['Coding','Coding','Summarization','Summarization','Structured Extraction','Structured Extraction','Q&A','Q&A','Coding','Summarization'])[i],
 'Nadia Haddad', 'Developer Productivity',
 jsonb_build_array('Review: def avg(x): return sum(x)/len(x)', 'Summarize: Q3 revenue grew 12% while costs fell 3%.', 'Extract JSON {vendor,total} from: Invoice from Acme Corp total $1,240.50'),
 (array['Identifies empty-list bug','Valid SQL','<= 3 sentences','Mentions key numbers','Valid JSON with vendor,total','Valid JSON','Answers grounded','Concise','Actionable','Chronological'])[i]
from generate_series(1,10) i;