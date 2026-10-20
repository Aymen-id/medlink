type LoginPage={ goto:(url:string)=>Promise<unknown>;locator:(selector:string)=>{ fill:(value:string)=>Promise<unknown>;click:()=>Promise<unknown> };waitForURL:(url:RegExp,options:{ timeout:number })=>Promise<unknown> };
/** Never downgrade a failed authenticated journey into an anonymous-route test. */
export async function requireLogin(page:LoginPage,credentials:{ email?:string;password?:string }) {
  if(!credentials.email || !credentials.password) throw new Error('Set TEST_USER_EMAIL and TEST_USER_PASSWORD to a dedicated synthetic Supabase test account');
  await page.goto('/login');
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/patients\/?(?:\?.*)?$/,{ timeout:15_000 });
}
