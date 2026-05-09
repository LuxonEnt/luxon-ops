'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Clock, DollarSign, FileText, Users } from 'lucide-react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { calculatePay, hoursBetween, money } from '@/lib/pay';

const contractors = [
  { id: 1, name: 'Chris Ayala', role: 'L1 / Lighting Tech', rate: 400, rateType: 'day' as const },
  { id: 2, name: 'Morris Ramos', role: 'Video Engineer', rate: 550, rateType: 'day' as const },
  { id: 3, name: 'James Barber', role: 'A1 / FOH Engineer', rate: 650, rateType: 'day' as const },
  { id: 4, name: 'Bryant Aquino', role: 'Stagehand', rate: 35, rateType: 'hour' as const },
];

const assignments = [
  { id: 101, contractorId: 1, eventName: 'CSUDH Graduation', client: 'CSUDH', date: '2026-05-11', role: 'Crew Lead / Stagehand', clockIn: '08:00', clockOut: '18:00', breakHours: 1, approved: true },
  { id: 102, contractorId: 4, eventName: 'CSUDH Graduation', client: 'CSUDH', date: '2026-05-17', role: 'Stagehand', clockIn: '09:00', clockOut: '21:00', breakHours: 1, approved: false },
  { id: 103, contractorId: 3, eventName: 'Rosemont Middle School Event', client: 'Rosemont Middle School', date: '2026-05-09', role: 'A1', clockIn: '12:00', clockOut: '22:00', breakHours: 1, approved: true },
];

export default function AdminDashboard() {
  const [approved, setApproved] = useState<Record<number, boolean>>(Object.fromEntries(assignments.map(a => [a.id, a.approved])));

  const rows = useMemo(() => assignments.map(a => {
    const contractor = contractors.find(c => c.id === a.contractorId)!;
    const hours = hoursBetween(a.clockIn, a.clockOut, a.breakHours);
    const total = calculatePay(contractor.rate, contractor.rateType, hours);
    return { ...a, contractor, hours, total, approved: approved[a.id] };
  }), [approved]);

  const totalPayroll = rows.reduce((sum, row) => sum + row.total, 0);
  const pending = rows.filter(row => !row.approved).length;

  const invoice = rows
    .filter(row => row.approved)
    .map(row => `${row.contractor.name} — ${row.role} — ${row.date} — ${row.hours.toFixed(2)} hrs — ${money(row.total)}`)
    .join('\n');

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <h1 className="text-3xl font-bold">Luxon Admin</h1>
          <p className="text-slate-600">Manage crew, approve timesheets, and generate invoice drafts.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric icon={<CalendarDays />} label="Events" value="2" />
          <Metric icon={<Users />} label="Contractors" value={String(contractors.length)} />
          <Metric icon={<Clock />} label="Pending" value={String(pending)} />
          <Metric icon={<DollarSign />} label="Payroll" value={money(totalPayroll)} />
        </div>

        <Card className="overflow-hidden">
          <div className="border-b p-4 font-bold">Timesheets</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Contractor</th>
                  <th className="p-3">Event</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Hours</th>
                  <th className="p-3">Pay</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-medium">{row.contractor.name}</td>
                    <td className="p-3">{row.eventName}</td>
                    <td className="p-3">{row.date}</td>
                    <td className="p-3">{row.hours.toFixed(2)}</td>
                    <td className="p-3 font-bold">{money(row.total)}</td>
                    <td className="p-3">{row.approved ? 'Approved' : 'Pending'}</td>
                    <td className="p-3"><Button disabled={row.approved} onClick={() => setApproved({ ...approved, [row.id]: true })}>Approve</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><FileText className="h-5 w-5" /> Invoice Draft</h2>
          <pre className="whitespace-pre-wrap rounded-xl bg-slate-100 p-4 text-sm">Client: CSUDH\nPayment Terms: Net 30\n\n{invoice}\n\nSubtotal: {money(rows.filter(row => row.approved).reduce((sum, row) => sum + row.total, 0))}</pre>
        </Card>
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card className="p-4"><div className="mb-2 text-slate-500">{icon}</div><div className="text-sm text-slate-500">{label}</div><div className="text-xl font-bold">{value}</div></Card>;
}
