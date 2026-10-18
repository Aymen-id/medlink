// @vitest-environment node
import { afterAll,beforeAll,expect,it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser,createTestDatabase,ids } from './harness';
let db:PGlite;
beforeAll(async()=>{
  db=await createTestDatabase();
  for(let index=0;index<4;index++) await db.query("INSERT INTO patient_files(patient_id,file_name,storage_path) VALUES ($1,$2,$3)",[ids.patient,`Échographie résultat ${index}.pdf`,`${ids.owner}/${ids.patient}/echo-${index}`]);
},120000);
afterAll(async()=>{ await db?.close(); });
it('matches accent-insensitive names and partial substrings with reachable later pages',async()=>{
  const search=(query:string,page=1)=>asUser(db,ids.owner,()=>db.query('SELECT id FROM search_workspace_files($1,$2,$3,2)',[ids.owner,query,page]));
  expect((await search('echographie')).rows).toHaveLength(3); // 2 + next-page sentinel
  expect((await search('chogra',2)).rows).toHaveLength(2);
  expect((await search('résultat')).rows).toHaveLength(3);
});
it('keeps direct RPC searches scoped by current membership and validates pagination',async()=>{
  expect((await asUser(db,ids.outsider,()=>db.query('SELECT id FROM search_workspace_files($1,$2,1,20)',[ids.owner,'echo']))).rows).toHaveLength(0);
  await expect(asUser(db,ids.owner,()=>db.query('SELECT id FROM search_workspace_files($1,$2,0,20)',[ids.owner,'echo']))).rejects.toThrow();
});
