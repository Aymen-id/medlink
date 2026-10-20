// @vitest-environment node
import {afterAll,beforeAll,expect,it} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {asUser,createTestDatabase,ids} from './harness';
let db:PGlite;
beforeAll(async()=>{db=await createTestDatabase();},120000);
afterAll(async()=>{await db?.close();});
it('does not give API roles TRUNCATE privileges that bypass row policies',async()=>{
  await expect(asUser(db,ids.outsider,()=>db.exec('TRUNCATE patient_files CASCADE'))).rejects.toThrow(/permission denied/);
});
it('keeps private table discovery and trigger-only privileged functions unavailable to anonymous clients',async()=>{
  expect((await db.query<{allowed:boolean}>("SELECT has_table_privilege('anon','patients','SELECT') AS allowed")).rows[0].allowed).toBe(false);
  expect((await db.query<{allowed:boolean}>("SELECT has_function_privilege('anon','handle_new_user()','EXECUTE') AS allowed")).rows[0].allowed).toBe(false);
  expect((await db.query<{allowed:boolean}>("SELECT has_table_privilege('anon','doctor_profiles','SELECT') AS allowed")).rows[0].allowed).toBe(true);
});
