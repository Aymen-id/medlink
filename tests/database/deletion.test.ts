// @vitest-environment node
import { afterAll,beforeAll,expect,it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser,createTestDatabase,ids } from './harness';
let db:PGlite;
beforeAll(async()=>{ db=await createTestDatabase(); },120000);
afterAll(async()=>{ await db?.close(); });
it('queues expired uploads before deleting their reservation records',async()=>{
  const result=await asUser(db,ids.owner,()=>db.query<{ reservation:{ id:string;storage_path:string } }>("SELECT reserve_patient_upload($1,NULL,'expired.pdf','application/pdf',3,'{}') AS reservation",[ids.patient]));
  const upload=result.rows[0].reservation;
  await db.query("UPDATE upload_reservations SET expires_at=now()-interval '1 minute' WHERE id=$1",[upload.id]);
  expect((await db.query<{ count:number }>('SELECT queue_expired_uploads() AS count')).rows[0].count).toBe(1);
  expect((await db.query('SELECT * FROM storage_deletion_queue WHERE storage_path=$1',[upload.storage_path])).rows).toHaveLength(1);
  expect((await db.query('SELECT * FROM upload_reservations WHERE id=$1',[upload.id])).rows).toHaveLength(0);
  await db.query('DELETE FROM storage_deletion_queue');
});
it('queues finalized and unfinished objects durably when a patient is deleted',async()=>{
  const result=await asUser(db,ids.owner,()=>db.query<{ reservation:{ id:string;storage_path:string } }>("SELECT reserve_patient_upload($1,NULL,'pending.pdf','application/pdf',3,'{}') AS reservation",[ids.patient]));
  const pending=result.rows[0].reservation;
  const path=`${ids.owner}/${ids.patient}/legacy`;
  await db.query("INSERT INTO patient_files(patient_id,file_name,storage_path) VALUES ($1,'legacy.pdf',$2)",[ids.patient,path]);
  await asUser(db,ids.editor,()=>db.query('DELETE FROM patients WHERE id=$1',[ids.patient]));
  const queued=await db.query<{ storage_path:string }>('SELECT storage_path FROM storage_deletion_queue');
  expect(queued.rows.map(row=>row.storage_path).sort()).toEqual([path,pending.storage_path].sort());
  expect((await db.query('SELECT * FROM upload_reservations')).rows).toHaveLength(0);
  await expect(asUser(db,ids.editor,()=>db.query('SELECT * FROM storage_deletion_queue'))).rejects.toThrow(/permission denied/);
});
