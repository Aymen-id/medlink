import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { FileText,CalendarDays,Globe,Check,FolderLock,ArrowRight } from 'lucide-react';
import { TIER_PRICING } from '@/lib/constants';

export default function Home() {
  return <div className="min-h-screen bg-background text-foreground">
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4 focus:underline">Skip to content</a>
    <header className="border-b border-border"><nav aria-label="Main navigation" className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
      <Link href="/" aria-label="MediLink home"><Image src="/medilink-logo.svg" width={136} height={32} alt="MediLink" priority /></Link>
      <div className="hidden items-center gap-8 text-sm md:flex"><Link href="#features" className="hover:text-primary">How it works</Link><Link href="#pricing" className="hover:text-primary">Pricing</Link></div>
      <div className="flex items-center gap-3"><Link href="/login" className="whitespace-nowrap text-sm font-medium text-primary">Log in</Link><Button render={<Link href="/signup" />}>Get started</Button></div>
    </nav></header>
    <main id="main">
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-7"><h1 className="max-w-lg text-4xl leading-tight font-semibold tracking-tight sm:text-5xl lg:text-6xl">Your practice, in one place.</h1><p className="max-w-md text-lg leading-relaxed text-muted-foreground">A private workspace for patient records. A public page for your practice. Less time searching for files, more time with your patients.</p><div className="flex flex-wrap items-center gap-4"><Button size="lg" render={<Link href="/signup" />}>Start for free <ArrowRight className="size-4" /></Button><Link href="#features" className="text-sm font-medium text-primary underline underline-offset-4">Explore the workspace</Link></div><p className="text-sm text-muted-foreground">No credit card needed. Free includes your profile and 10 patient files.</p></div>
        <div className="space-y-4 rounded-2xl border border-border bg-muted/40 p-4 sm:p-6" aria-label="Example workspace and public profile">
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Example workspace</span><FolderLock className="size-4 text-primary" /></div>
          <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm"><div className="flex justify-between border-b pb-3"><div><p className="font-semibold">Patient records</p><p className="mt-1 text-xs text-muted-foreground">Organized for your next appointment</p></div><FileText className="size-5 text-primary" /></div>{['Consultation summary.pdf','Lab results.pdf','Follow-up notes'].map((name,index)=><div key={name} className="flex items-center gap-3 text-sm"><div className="rounded-md bg-accent p-2"><FileText className="size-4 text-primary" /></div><span className="min-w-0 flex-1 truncate">{name}</span><span className="text-xs text-muted-foreground">{index===2 ? 'Note':'PDF'}</span></div>)}</div>
          <div className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm"><div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">AB</div><div className="min-w-0"><p className="font-semibold">Dr. Amina Benali</p><p className="text-sm text-muted-foreground">General practice</p><p className="mt-1 truncate text-xs text-primary">medilink.io/dr-amina-benali</p></div><Globe className="ml-auto size-5 shrink-0 text-primary" /></div>
          <p className="text-xs text-muted-foreground">Illustrative content. No real patient records.</p>
        </div>
      </section>
      <section id="features" className="border-y bg-muted/30"><div className="mx-auto max-w-6xl px-5 py-16 sm:px-8"><h2 className="max-w-xl text-3xl font-semibold tracking-tight">Keep the work around care simple.</h2><div className="mt-10 grid gap-10 md:grid-cols-3">{[
        { icon:FolderLock,title:'Find the right file',body:'Keep patient documents in folders, add tags, and search by name. Give assistants explicit view or edit access.' },
        { icon:CalendarDays,title:'Keep the appointment context',body:'Record timestamped notes on Pro or Clinic. Return to the history before the next consultation.' },
        { icon:Globe,title:'Make your practice easy to find',body:'Share your specialty, clinic hours and contact details on a public profile with a simple physician address.' },
      ].map(feature=><article key={feature.title} className="space-y-4"><feature.icon className="size-6 text-primary" /><h3 className="text-lg font-semibold">{feature.title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{feature.body}</p></article>)}</div></div></section>
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20"><div className="max-w-xl space-y-3"><h2 className="text-3xl font-semibold tracking-tight">Room to grow with your practice.</h2><p className="text-muted-foreground">Start with the essentials. Add notes, analytics and more workspaces as you need them. Annual billing saves 20%.</p></div><div className="mt-10 grid gap-5 md:grid-cols-3">{[
        { name:'Free',price:0,description:'Your first workspace',features:['Public physician profile','Up to 10 patient files','Folders, tags and filename search'] },
        { name:'Pro',price:TIER_PRICING.pro.monthly,description:'For your daily practice',features:['Everything in Free','Unlimited patient files','Appointment notes and profile analytics'] },
        { name:'Clinic',price:TIER_PRICING.clinic.monthly,description:'For a small group practice',features:['Everything in Pro','Up to 8 physician workspaces','One billing admin, separate patient records'] },
      ].map(plan=><article key={plan.name} className={`flex flex-col rounded-xl border p-6 ${plan.name==='Pro' ? 'border-primary bg-accent/40':'border-border bg-card'}`}><h3 className="text-lg font-semibold">{plan.name}</h3><p className="mt-1 text-sm text-muted-foreground">{plan.description}</p><p className="my-5"><span className="text-4xl font-semibold">${plan.price}</span><span className="text-sm text-muted-foreground"> / month</span></p><ul className="mb-7 flex-1 space-y-3">{plan.features.map(feature=><li key={feature} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{feature}</li>)}</ul><Button variant={plan.name==='Pro' ? 'default':'outline'} render={<Link href="/signup" />}>Choose {plan.name}</Button></article>)}</div></section>
    </main>
    <footer className="border-t"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8"><p>MediLink · Built around independent practice.</p><Link href="/signup" className="font-medium text-primary">Create your workspace</Link></div></footer>
  </div>;
}
