// @vitest-environment node
import { afterAll,beforeAll,expect,it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser,createTestDatabase,ids } from './harness';
let db:PGlite;
beforeAll(async()=>{ db=await createTestDatabase();await db.query('UPDATE doctor_profiles SET is_published=true WHERE id=$1',[ids.owner]); },120000);
afterAll(async()=>{ await db?.close(); });
it('accepts public endpoint events through a service-only function with persistent atomic limits',async()=>{
  for(let index=0;index<30;index++) expect((await db.query<{ result:string }>("SELECT record_profile_event($1,'view',NULL,NULL,NULL,$2) AS result",[ids.owner,'a'.repeat(64)])).rows[0].result).toBe('accepted');
  expect((await db.query<{ result:string }>("SELECT record_profile_event($1,'view',NULL,NULL,NULL,$2) AS result",[ids.owner,'a'.repeat(64)])).rows[0].result).toBe('rate_limited');
  await expect(asUser(db,null,()=>db.query("SELECT record_profile_event($1,'view',NULL,NULL,NULL,$2)",[ids.owner,'b'.repeat(64)]))).rejects.toThrow();
  await expect(asUser(db,null,()=>db.query("INSERT INTO profile_analytics(profile_id) VALUES ($1)",[ids.owner]))).rejects.toThrow();
});
it('separates clicks from views and includes direct referrals in SQL aggregation',async()=>{
  await db.query("SELECT record_profile_event($1,'click','booking',NULL,NULL,$2)",[ids.owner,'b'.repeat(64)]);
  const result=await asUser(db,ids.owner,()=>db.query<{ metrics:{ summary:{ totalViews:number;totalClicks:number;ctr:number };referrers:{ source:string;count:number }[] } }>('SELECT get_profile_analytics($1,7) AS metrics',[ids.owner]));
  expect(result.rows[0].metrics.summary).toEqual({ totalViews:30,totalClicks:1,ctr:3.33 });
  expect(result.rows[0].metrics.referrers).toEqual([{ source:'Direct',count:30 }]);
  await expect(asUser(db,ids.outsider,()=>db.query('SELECT get_profile_analytics($1,7)',[ids.owner]))).rejects.toThrow();
});
