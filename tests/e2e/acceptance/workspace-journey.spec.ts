import {test,expect} from '../../fixtures/auth';
import {PatientsPage} from '../../pages/PatientsPage';
import JSZip from 'jszip';

// Requires a dedicated Pro/Clinic synthetic account. Never run with patient data.
for(const viewport of [{width:1280,height:800},{width:390,height:844}]) {
test(`physician manages a synthetic patient, file, folder, note, search and ZIP at ${viewport.width}px`,async({authenticatedPage:page})=>{
  test.setTimeout(120000);
  await page.setViewportSize(viewport);
  const suffix=Date.now().toString(36),lastName=`Acceptance${suffix}`,filename=`synthetic-${suffix}.pdf`;
  const source=Buffer.from('%PDF-1.4\nSynthetic acceptance bytes only\n');
  const patients=new PatientsPage(page);
  await patients.goto();
  await expect(page.getByRole('combobox',{name:'Workspace'})).not.toHaveText(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  await patients.createPatient({firstName:'QASynthetic',lastName});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await patients.expectPatientInList(lastName);await patients.clickPatient(lastName);
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}/);
  const patientPath=new URL(page.url()).pathname;
  await page.getByRole('button',{name:'Edit patient',exact:true}).click();
  await page.getByLabel('Phone',{exact:true}).fill('+216 20000000');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'New Folder'}).click();
  await page.getByRole('textbox',{name:'Folder name'}).fill('Synthetic Reports');
  await page.getByRole('button',{name:'Create Folder',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Upload File',exact:true}).click();
  await page.getByLabel('Select File').setInputFiles({name:filename,mimeType:'application/pdf',buffer:source});
  await page.getByLabel('Tags (comma-separated)').fill('synthetic, review');
  await page.getByRole('button',{name:'Upload',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0,{timeout:30000});
  await expect(page.getByText(filename,{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  if(viewport.width===390)await page.screenshot({path:'.tmp/dashboard-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Move / tags'}).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option',{name:'Synthetic Reports',exact:true}).click();
  await page.getByRole('button',{name:'Save file',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(filename,{exact:true})).toHaveCount(0);
  await page.getByText('Synthetic Reports',{exact:true}).click();
  await expect(page.getByText(filename,{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Appointment Notes'}).click();
  await page.getByLabel('New appointment note').fill('Synthetic appointment history');
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  await expect(page.getByText('Synthetic appointment history',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit note',exact:true}).click();
  await page.getByLabel('Edit appointment note').fill('Synthetic history updated');
  await page.getByRole('button',{name:'Save note changes',exact:true}).click();
  await expect(page.getByText('Synthetic history updated',{exact:true})).toBeVisible();
  await page.goto(`/search?q=${encodeURIComponent(filename)}`);
  await page.getByRole('link',{name:new RegExp(filename.replaceAll('.','\\.'))}).click();
  await expect(page).toHaveURL(new RegExp(`${patientPath}\\?folderId=`));
  await expect(page.getByText(filename,{exact:true})).toBeVisible();
  const exported=await page.request.get(`/api${patientPath}/export`);
  expect(exported.status()).toBe(200);
  const zip=await JSZip.loadAsync(await exported.body());
  const entry=Object.values(zip.files).find(file=>!file.dir && file.name.endsWith(filename));
  expect(entry).toBeDefined();expect(await entry!.async('nodebuffer')).toEqual(source);
  await page.getByRole('button',{name:'Delete patient',exact:true}).click();
  await page.getByRole('button',{name:'Confirm deletion',exact:true}).click();
  await expect(page).toHaveURL(/\/patients$/);
  await expect(page.getByRole('row').filter({hasText:lastName})).toHaveCount(0);
});
}

test('a stale workspace selection recovers to an available authorized workspace',async({authenticatedPage:page})=>{
  await page.context().addCookies([{name:'medilink-workspace',value:'00000000-0000-4000-8000-999999999999',url:process.env.BASE_URL ?? 'http://localhost:3000',httpOnly:true,sameSite:'Lax'}]);
  await page.goto('/patients');
  await expect(page.getByRole('heading',{name:/^(Patients|Choose an available workspace)$/})).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);
});
