import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

export const ids = {
  owner: '00000000-0000-4000-8000-000000000001',
  editor: '00000000-0000-4000-8000-000000000002',
  viewer: '00000000-0000-4000-8000-000000000003',
  outsider: '00000000-0000-4000-8000-000000000004',
  patient: '10000000-0000-4000-8000-000000000001',
};

/** Real embedded PostgreSQL; Auth identity and Storage tables are local test shims. */
export async function createTestDatabase() {
  const db = new PGlite({ extensions:{ unaccent,pg_trgm } });
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz DEFAULT now(), raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
    CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text, owner uuid, metadata jsonb, UNIQUE(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1] $$;
  `);
  const directory = path.resolve('supabase/migrations');
  for (const file of ['00001_initial_schema.sql', '00002_auth_profile_trigger.sql']) {
    await db.exec(readFileSync(path.join(directory, file), 'utf8'));
  }
  for (const [label, id] of Object.entries(ids).filter(([label]) => label !== 'patient')) {
    await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,$2,$3)', [id, `${label}@synthetic.test`, JSON.stringify({ display_name: `Dr ${label}` })]);
  }
  await db.query("INSERT INTO patients(id,owner_id,first_name,last_name) VALUES ($1,$2,'Synthetic','Patient')", [ids.patient, ids.owner]);
  await db.query("INSERT INTO staff_access(owner_id,staff_user_id,role,permissions) VALUES ($1,$2,'assistant','edit'),($1,$3,'receptionist','view')", [ids.owner, ids.editor, ids.viewer]);
  await db.query("INSERT INTO subscriptions(user_id,tier,status) VALUES ($1,'clinic','active')", [ids.owner]);
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql') && !name.startsWith('0000')).sort()) {
    await db.exec(readFileSync(path.join(directory, file), 'utf8'));
  }
  // Explicit grants model Supabase's API roles. Row policies still decide access.
  await db.exec('GRANT USAGE ON SCHEMA public, storage TO anon, authenticated; GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;');
  return db;
}

export async function asUser<T>(db: PGlite, userId: string | null, operation: () => Promise<T>): Promise<T> {
  await db.exec(`SET ROLE ${userId ? 'authenticated' : 'anon'}`);
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  try { return await operation(); }
  finally { await db.exec('RESET ROLE'); }
}
