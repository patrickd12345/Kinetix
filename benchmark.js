import { getSlaMetrics } from './api/_lib/supportTicketDerived.ts';

// Generate some dummy data with repeated timestamps and mixed null/invalid dates
const tickets = [];
const baseDate = new Date('2026-04-01T10:00:00.000Z');
const commonDate1 = baseDate.toISOString();
const commonDate2 = new Date(baseDate.getTime() + 100000).toISOString();
const commonDate3 = new Date(baseDate.getTime() + 50000).toISOString();

for (let i = 0; i < 50000; i++) {
  let created_at = i % 10 === 0 ? null : (i % 5 === 0 ? 'invalid-date' : commonDate1);
  let updated_at = i % 8 === 0 ? null : commonDate2;
  let last_operator_action_at = i % 12 === 0 ? null : commonDate3;

  tickets.push({
    ticket_id: `t-${i}`,
    status: i % 2 === 0 ? 'resolved' : 'open',
    created_at,
    updated_at,
    last_operator_action_at,
    derived: { labels: i % 7 === 0 ? ['overdue_first_response'] : [] }
  });
}

// Warmup
for (let i = 0; i < 20; i++) {
  getSlaMetrics(tickets, new Date('2026-04-08T12:00:00.000Z'));
}

const start = performance.now();
for (let i = 0; i < 100; i++) {
  getSlaMetrics(tickets, new Date('2026-04-08T12:00:00.000Z'));
}
const end = performance.now();
console.log(`Baseline Time taken: ${end - start} ms for 100 iterations on 50000 tickets`);
