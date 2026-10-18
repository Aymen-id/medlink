// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDatabase, ids } from './harness';

describe('workspace database and Storage authorization', () => {
  let db: PGlite;
  const otherPatient = '10000000-0000-4000-8000-000000000002';
  const folder = '20000000-0000-4000-8000-000000000001';
  const objectName = `${ids.owner}/${ids.patient}/synthetic-report.pdf`;
  beforeAll(async () => {
    db = await createTestDatabase();
    await db.query("INSERT INTO patients(id,owner_id,first_name,last_name) VALUES ($1,$2,'Other','Synthetic')", [otherPatient, ids.outsider]);
    await db.query("INSERT INTO folders(id,patient_id,name) VALUES ($1,$2,'Reports')", [folder, otherPatient]);
  }, 120_000);
  afterAll(async () => { await db?.close(); });

  it('allows owner/editor/viewer reads and blocks unrelated and anonymous reads', async () => {
    for (const id of [ids.owner, ids.editor, ids.viewer]) {
      expect((await asUser(db, id, () => db.query('SELECT id FROM patients WHERE id=$1', [ids.patient]))).rows).toHaveLength(1);
    }
    for (const id of [ids.outsider, null]) {
      const result = await asUser(db, id, () => db.query('SELECT id FROM patients WHERE id=$1', [ids.patient])).catch(() => ({ rows: [] }));
      expect(result.rows).toHaveLength(0);
    }
  });

  it('prevents a viewer from creating notes through direct SQL', async () => {
    await expect(asUser(db, ids.viewer, () => db.query('INSERT INTO appointment_notes(patient_id,author_id,content) VALUES ($1,$2,$3)', [ids.patient, ids.viewer, 'Synthetic note']))).rejects.toThrow();
  });

  it('prevents an editor from forging another author', async () => {
    await expect(asUser(db, ids.editor, () => db.query('INSERT INTO appointment_notes(patient_id,author_id,content) VALUES ($1,$2,$3)', [ids.patient, ids.owner, 'Forged author']))).rejects.toThrow();
  });

  it('rejects cross-patient folder references even for an authenticated editor', async () => {
    await expect(asUser(db, ids.editor, () => db.query('INSERT INTO patient_files(patient_id,folder_id,file_name,storage_path) VALUES ($1,$2,$3,$4)', [ids.patient, folder, 'Synthetic.pdf', objectName]))).rejects.toThrow();
  });

  it('creates a private bucket and keeps unregistered objects unreadable', async () => {
    expect((await db.query('SELECT public FROM storage.buckets WHERE id=$1', ['patient-files'])).rows).toEqual([{ public: false }]);
    await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2)', ['patient-files', objectName]);
    expect((await asUser(db, ids.editor, () => db.query('SELECT name FROM storage.objects WHERE name=$1', [objectName]))).rows).toHaveLength(0);
    await db.query('INSERT INTO patient_files(patient_id,file_name,storage_path) VALUES ($1,$2,$3)', [ids.patient, 'Synthetic.pdf', objectName]);
    // Reads must use the application endpoint; SELECT also enables bearer-URL minting.
    expect((await asUser(db, ids.viewer, () => db.query('SELECT name FROM storage.objects WHERE name=$1', [objectName]))).rows).toHaveLength(0);
    expect((await db.query('SELECT name FROM storage.objects WHERE name=$1',[objectName])).rows).toHaveLength(1);
    expect((await asUser(db, ids.outsider, () => db.query('SELECT name FROM storage.objects WHERE name=$1', [objectName]))).rows).toHaveLength(0);
  });

  it('blocks viewer uploads and unrelated object deletion', async () => {
    await expect(asUser(db, ids.viewer, () => db.query('INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2)', ['patient-files', `${objectName}-viewer`]))).rejects.toThrow();
    const result = await asUser(db, ids.outsider, () => db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name', [objectName]));
    expect(result.rows).toHaveLength(0);
  });

  it('lets an editor create their own note while keeping viewers read-only', async () => {
    const note = await asUser(db, ids.editor, () => db.query('INSERT INTO appointment_notes(patient_id,author_id,content) VALUES ($1,$2,$3) RETURNING id', [ids.patient, ids.editor, 'A synthetic authorized note']));
    expect(note.rows).toHaveLength(1);
    const update = await asUser(db, ids.viewer, () => db.query("UPDATE patients SET first_name='Changed' WHERE id=$1 RETURNING id", [ids.patient]));
    expect(update.rows).toHaveLength(0);
  });

  it('revokes record and object access immediately when explicit membership is removed', async () => {
    await db.query('DELETE FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2', [ids.owner, ids.viewer]);
    expect((await asUser(db, ids.viewer, () => db.query('SELECT id FROM patients WHERE id=$1', [ids.patient]))).rows).toHaveLength(0);
    expect((await asUser(db, ids.viewer, () => db.query('SELECT name FROM storage.objects WHERE name=$1', [objectName]))).rows).toHaveLength(0);
  });
});
