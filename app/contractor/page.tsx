'use client';

import { useState } from 'react';
import { MapPin, Clock, CheckCircle2, DollarSign } from 'lucide-react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { calculatePay, hoursBetween, money } from '@/lib/pay';

const jobs = [
  {
    id: 1,
    eventName: 'CSUDH Graduation',
    client: 'Cal State University Dominguez Hills',
    venue: 'Dignity Health Sports Park',
    address: '18400 Avalon Blvd, Carson, CA 90746',
    workDate: '2026-05-11',
    callTime: '08:00',
    endTime: '18:00',
    position: 'Crew Lead / Stagehand',
    rate: 400,
    rateType: 'day' as const,
    breakHours: 1,
  },
  {
    id: 2,
    eventName: 'Rosemont Middle School Event',
    client: 'Rosemont Middle School',
    venue: 'Rosemont Middle School',
    address: '4725 Rosemont Ave, La Crescenta-Montrose, CA 91214',
    workDate: '2026-05-09',
    callTime: '12:00',
    endTime: '22:00',
    position: 'A1',
    rate: 650,
    rateType: 'day' as const,
    breakHours: 1,
  },
];

export default function ContractorPortal() {
  const [confirmed, setConfirmed] = useState<Record<number, boolean>>({});
  const [time, setTime] = useState<Record<number, { in?: string; out?: string }>>({});

  function nowTime() {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  return (
    <main className="min-h-screen p-4 pb-24">
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <h1 className="text-3xl font-bold">My Luxon Jobs</h1>
          <p className="text-slate-600">Confirm your calls, clock in/out, and view estimated pay.</p>
        </div>

        {jobs.map(job => {
          const clockIn = time[job.id]?.in;
          const clockOut = time[job.id]?.out;
          const workedHours = hoursBetween(clockIn || job.callTime, clockOut || job.endTime, job.breakHours);
          const pay = calculatePay(job.rate, job.rateType, workedHours);

          return (
            <Card key={job.id} className="p-5 space-y-4">
              <div>
                <h2 className="text-xl font-bold">{job.eventName}</h2>
                <p className="text-sm text-slate-600">{job.position}</p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="flex gap-2"><MapPin className="h-4 w-4" /> {job.venue}</p>
                <p className="text-slate-600 pl-6">{job.address}</p>
                <p className="flex gap-2"><Clock className="h-4 w-4" /> {job.workDate} · {job.callTime} - {job.endTime}</p>
                <p className="flex gap-2"><DollarSign className="h-4 w-4" /> {money(job.rate)} / {job.rateType}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button className={confirmed[job.id] ? 'bg-emerald-700' : ''} onClick={() => setConfirmed({ ...confirmed, [job.id]: true })}>
                  <CheckCircle2 className="mr-1 inline h-4 w-4" /> {confirmed[job.id] ? 'Confirmed' : 'Confirm'}
                </Button>
                <a className="rounded-xl border px-4 py-2 text-center font-medium" href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}>Open Map</a>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setTime({ ...time, [job.id]: { ...time[job.id], in: nowTime() } })}>Clock In</Button>
                <Button onClick={() => setTime({ ...time, [job.id]: { ...time[job.id], out: nowTime() } })}>Clock Out</Button>
              </div>

              <div className="rounded-xl bg-slate-100 p-3 text-sm">
                <p>Clock In: {clockIn || 'Not clocked in'}</p>
                <p>Clock Out: {clockOut || 'Not clocked out'}</p>
                <p>Estimated Hours: {workedHours.toFixed(2)}</p>
                <p className="font-bold">Estimated Pay: {money(pay)}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
