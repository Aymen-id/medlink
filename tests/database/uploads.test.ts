// @vitest-environment node
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser,createTestDatabase,ids } from './harness';
type Reservation={ id:string;storage_path:string };
describe('atomic upload reservations on PostgreSQL', () => {
  let db:PGlite;
  let reservation:Reservation;
  beforeAll(async () => {
    db=await createTestDatabase();
    await db.query("UPDATE subscriptions SET tier='free' WHERE user_id=$1",[ids.owner]);
    for(let index=0;index<9;index++) await db.query('INSERT INTO patient_files(patient_id,file_name,storage_path,size_bytes) VALUES ($1,$2,$3,3)',[ids.patient,`seed-${index}.pdf`,`${ids.owner}/${ids.patient}/seed-${index}`]);
  },120_000);
  afterAll(async () => { await db?.close(); });
  const reserve=()=>asUser(db,ids.owner,()=>db.query<{ reservation:Reservation }>("SELECT reserve_patient_upload($1,NULL,'report.pdf','application/pdf',3,'{}') AS reservation",[ids.patient]));

  it('reserves only one available slot when two uploads are queued at nine files',async () => {
    const results=await Promise.allSettled([reserve(),reserve()]);
    const accepted=results.filter(result=>result.status==='fulfilled');
    expect(accepted).toHaveLength(1);
    const success=accepted[0]; if(success.status==='fulfilled') reservation=success.value.rows[0].reservation;
  });
  it('blocks direct metadata inserts that bypass quota reservation',async () => {
    await expect(asUser(db,ids.owner,()=>db.query('INSERT INTO patient_files(patient_id,file_name,storage_path) VALUES ($1,$2,$3)',[ids.patient,'bypass.pdf',`${ids.owner}/${ids.patient}/bypass`]))).rejects.toThrow();
  });
  it('finalizes only a matching object and counts it once',async () => {
    await asUser(db,ids.owner,()=>db.query('INSERT INTO storage.objects(bucket_id,name,metadata) VALUES ($1,$2,$3)', ['patient-files',reservation.storage_path,JSON.stringify({ size:3,mimetype:'application/pdf' })]));
    await asUser(db,ids.owner,()=>db.query('SELECT finalize_patient_upload($1)',[reservation.id]));
    await asUser(db,ids.owner,()=>db.query('SELECT finalize_patient_upload($1)',[reservation.id]));
    expect((await db.query('SELECT id FROM patient_files WHERE patient_id=$1',[ids.patient])).rows).toHaveLength(10);
    await expect(reserve()).rejects.toThrow();
  });
  it('releases a canceled reservation without making an orphan object readable',async () => {
    await db.query('DELETE FROM patient_files WHERE storage_path=$1',[reservation.storage_path]);
    const first=(await reserve()).rows[0].reservation;
    await asUser(db,ids.owner,()=>db.query('SELECT cancel_patient_upload($1)',[first.id]));
    expect((await reserve()).rows).toHaveLength(1);
  });
  it('rechecks the Free cap when paid reservations finalize after a downgrade',async () => {
    await db.query("UPDATE subscriptions SET tier='pro' WHERE user_id=$1",[ids.owner]);
    const first=(await reserve()).rows[0].reservation;
    const second=(await reserve()).rows[0].reservation;
    for(const upload of [first,second]) {
      await asUser(db,ids.owner,()=>db.query('INSERT INTO storage.objects(bucket_id,name,metadata) VALUES ($1,$2,$3)', ['patient-files',upload.storage_path,JSON.stringify({ size:3,mimetype:'application/pdf' })]));
    }
    await db.query("UPDATE subscriptions SET tier='free' WHERE user_id=$1",[ids.owner]);
    await asUser(db,ids.owner,()=>db.query('SELECT finalize_patient_upload($1)',[first.id]));
    await expect(asUser(db,ids.owner,()=>db.query('SELECT finalize_patient_upload($1)',[second.id]))).rejects.toThrow(/Free file limit/);
    expect((await db.query('SELECT id FROM patient_files WHERE patient_id=$1',[ids.patient])).rows).toHaveLength(10);
  });
});
