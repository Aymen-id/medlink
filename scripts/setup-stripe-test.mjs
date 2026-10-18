/** Approved isolated USD test setup. Never modifies or archives existing Stripe objects. */
import fs from 'node:fs';
import Stripe from 'stripe';
const envPath=new URL('../.env.local',import.meta.url);
const source=fs.readFileSync(envPath,'utf8'),env={};
for(const line of source.split(/\r?\n/)) { const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match) env[match[1]]=match[2].replace(/^["']|["']$/g,''); }
if(!/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? '')) throw new Error('A Stripe test-mode key is required');
if(!process.argv.includes('--apply')) { process.stdout.write('Plan: create separate USD Pro 29/month or 278.40/year, Clinic 99/month or 950.40/year, and isolated Portal configuration. Use --apply only after approval.\n');process.exit(0); }
const stripe=new Stripe(env.STRIPE_SECRET_KEY,{ apiVersion:'2026-02-25.clover',timeout:20000,maxNetworkRetries:1 });
const output={ products:{},prices:{},portalConfiguration:null };
const key='medilink-usd-acceptance-20261018';
for(const [tier,monthly,annual] of [['pro',2900,27840],['clinic',9900,95040]]) {
  const product=await stripe.products.create({ name:`MediLink ${tier==='pro' ? 'Pro':'Clinic'} (USD acceptance test)`,metadata:{ medilink_project:'pzjmnvgggbocwhzsveuc',purpose:'synthetic_acceptance',tier } },{ idempotencyKey:`${key}:product:${tier}` });
  output.products[tier]=product.id;
  for(const [interval,amount] of [['monthly',monthly],['annual',annual]]) {
    const price=await stripe.prices.create({ product:product.id,currency:'usd',unit_amount:amount,recurring:{ interval:interval==='annual' ? 'year':'month' },metadata:{ purpose:'synthetic_acceptance' } },{ idempotencyKey:`${key}:price:${tier}:${interval}` });
    if(price.livemode) throw new Error('Live object rejected');output.prices[`${tier}_${interval}`]=price.id;
  }
}
const portal=await stripe.billingPortal.configurations.create({ business_profile:{ headline:'Manage your MediLink test subscription' },features:{ subscription_update:{ enabled:true,default_allowed_updates:['price'],proration_behavior:'always_invoice',products:Object.entries(output.products).map(([tier,product])=>({ product,prices:[output.prices[`${tier}_monthly`],output.prices[`${tier}_annual`]] })) },subscription_cancel:{ enabled:true,mode:'at_period_end' },payment_method_update:{ enabled:true },invoice_history:{ enabled:true } },metadata:{ purpose:'synthetic_acceptance',medilink_project:'pzjmnvgggbocwhzsveuc' } },{ idempotencyKey:`${key}:portal` });
output.portalConfiguration=portal.id;
fs.mkdirSync(new URL('../.tmp/',import.meta.url),{ recursive:true });
fs.writeFileSync(new URL('../.tmp/stripe-test-setup.json',import.meta.url),JSON.stringify(output,null,2));
// Keep the original local configuration recoverable without exposing it in output.
const backup=new URL('../.tmp/env-before-stripe-usd.local',import.meta.url);
if(!fs.existsSync(backup)) fs.copyFileSync(envPath,backup,fs.constants.COPYFILE_EXCL);
const names={ STRIPE_PRICE_PRO_MONTHLY:output.prices.pro_monthly,STRIPE_PRICE_PRO_ANNUAL:output.prices.pro_annual,STRIPE_PRICE_CLINIC_MONTHLY:output.prices.clinic_monthly,STRIPE_PRICE_CLINIC_ANNUAL:output.prices.clinic_annual,STRIPE_PORTAL_CONFIGURATION_ID:portal.id };
const legacy=['NEXT_PUBLIC_STRIPE_PRO_PRICE_ID','NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID','NEXT_PUBLIC_STRIPE_CLINIC_PRICE_ID','NEXT_PUBLIC_STRIPE_CLINIC_ANNUAL_PRICE_ID'];
const lines=source.split(/\r?\n/).filter(line=>!Object.keys(names).some(name=>line.startsWith(name+'=')) && !legacy.some(name=>line.startsWith(name+'=')));
fs.writeFileSync(envPath,lines.join('\n').trimEnd()+'\n'+Object.entries(names).map(([name,value])=>`${name}=${value}`).join('\n')+'\n');
process.stdout.write('Created separate USD test products, four prices and a Portal configuration; updated ignored local settings. Original Stripe objects are unchanged.\n');
