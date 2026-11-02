import Link from 'next/link';
import { ArrowRight, Check, Users, CalendarDays, Wallet } from 'lucide-react';
import { getOptionalAdminUser } from '@/lib/admin-auth';

export default async function Home() {
  const admin = await getOptionalAdminUser();
  const destination = admin ? '/admin/overview' : '/admin/login';
  return <main className="min-h-dvh bg-white">
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
      <Link href="/" className="text-2xl font-bold tracking-[-0.03em] text-[var(--accent-ink)]">VowPal</Link>
      <nav aria-label="Main" className="flex items-center gap-5"><a href="#how-it-works" className="text-sm text-[var(--muted-text)] hover:text-[var(--foreground)] max-sm:hidden">How it works</a><Link href={destination} className="btn-secondary">{admin?'Open planner':'Sign in'}<ArrowRight className="h-4 w-4" aria-hidden /></Link></nav>
    </header>
    <section className="mx-auto grid max-w-6xl gap-12 px-5 pt-12 pb-16 sm:px-8 sm:pt-20 sm:pb-24 lg:grid-cols-[1fr_1.1fr] lg:items-center">
      <div>
        <h1 className="max-w-[13ch] text-5xl leading-[1.08] font-bold tracking-[-0.035em] text-balance sm:text-6xl">One wedding.<br />Every event.<br /><span className="text-[var(--accent)]">Everyone together.</span></h1>
        <p className="mt-6 text-lg font-semibold">Your wedding planning pal.</p>
        <p className="mt-3 max-w-[42ch] text-lg leading-relaxed text-[var(--muted-text)]">A shared place for your households, invitations, replies and wedding plans. From the Mehndi to the Walima, keep the details connected.</p>
        <Link href={destination} className="btn-primary mt-8 min-h-12 px-6">{admin?'Go to your planner':'Sign in to your planner'}<ArrowRight className="h-4 w-4" aria-hidden /></Link>
        {!admin?<p className="mt-3 text-sm text-[var(--muted-text)]">Already have an account? Your administrator provides access.</p>:null}
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--background)]">
        <div className="border-b border-[var(--border-soft)] bg-[var(--accent-ink)] px-5 py-5 text-white sm:px-7"><p className="text-lg font-semibold">Aisha & Omar</p><p className="mt-1 text-sm text-white/85">An illustrative wedding plan</p></div>
        <div className="px-5 py-6 sm:px-7">
          <div className="flex items-baseline justify-between gap-4"><h2 className="text-xl font-semibold">One household. Three celebrations.</h2></div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-text)]">Invite the Khan family to each event and see every reply in one place.</p>
          <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white">
            {[
              {event:'Mehndi',reply:'Attending · 4',confirmed:true},
              {event:'Nikkah',reply:'Attending · 3',confirmed:true},
              {event:'Walima',reply:'Awaiting reply',confirmed:false},
            ].map(row=><div key={row.event} className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-5 last:border-0"><span className="font-medium">{row.event}</span><span className={`flex items-center gap-2 text-sm ${row.confirmed?'text-[var(--success)]':'text-[var(--warning)]'}`}>{row.confirmed?<Check className="h-4 w-4" aria-hidden />:null}{row.reply}</span></div>)}
          </div>
          <p className="mt-5 text-sm text-[var(--muted-text)]">Separate invitations. A shared household list.</p>
        </div>
      </div>
    </section>
    <section id="how-it-works" className="border-y border-[var(--border-soft)] bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <h2 className="max-w-xl text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance">Make room for the celebration.</h2>
        <div className="mt-10 grid gap-10 md:grid-cols-3">
          <article><Users className="mb-4 h-6 w-6 text-[var(--accent)]" aria-hidden /><h3 className="text-lg font-semibold">Plan as a family</h3><p className="mt-2 text-base leading-relaxed text-[var(--muted-text)]">Give family contributors a place allowance for each event. Keep household counts and replies together.</p></article>
          <article><CalendarDays className="mb-4 h-6 w-6 text-[var(--accent)]" aria-hidden /><h3 className="text-lg font-semibold">An invitation for each event</h3><p className="mt-2 text-base leading-relaxed text-[var(--muted-text)]">Share personal RSVP links through your own WhatsApp or text composer. Guests reply on their phone.</p></article>
          <article><Wallet className="mb-4 h-6 w-6 text-[var(--accent)]" aria-hidden /><h3 className="text-lg font-semibold">Keep the practical details close</h3><p className="mt-2 text-base leading-relaxed text-[var(--muted-text)]">Track vendors, budget lines, payments and schedules alongside the guest list.</p></article>
        </div>
      </div>
    </section>
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-[var(--muted-text)] sm:px-8"><span className="font-semibold text-[var(--accent-ink)]">VowPal</span><Link href={destination} className="text-link">{admin?'Open planner':'Sign in'}</Link></footer>
  </main>;
}
