import Link from 'next/link';
import { Card } from '@/components/Card';

export default function Home() {
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-4xl font-bold">Luxon Ops</h1>
        <p className="text-slate-600">Contractor scheduling, clock-in/out, payroll approvals, and invoice drafts.</p>
        <div className="grid gap-3">
          <Link href="/admin"><Card className="p-5"><b>Admin Dashboard</b><p className="text-sm text-slate-600">Manage events, crew, hours, approvals, and invoices.</p></Card></Link>
          <Link href="/contractor"><Card className="p-5"><b>Contractor Portal</b><p className="text-sm text-slate-600">View jobs, confirm, clock in/out, and see approved pay.</p></Card></Link>
        </div>
      </div>
    </main>
  );
}
