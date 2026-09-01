-- Billing cycle fields: next due date + daily reminder dedupe.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS next_pay_date date,
  ADD COLUMN IF NOT EXISTS payment_reminder_sent_on date;

COMMENT ON COLUMN public.students.next_pay_date IS
  'Next amount due date. Student is paid while today < next_pay_date.';
COMMENT ON COLUMN public.students.payment_reminder_sent_on IS
  'CST calendar date a payment-reminder email was last sent (once per day).';

-- First due date defaults to start date when missing.
UPDATE public.students
SET next_pay_date = COALESCE(joining_date, applied_date::date, (created_at AT TIME ZONE 'America/Chicago')::date)
WHERE next_pay_date IS NULL
  AND COALESCE(payment_status, 'unpaid') NOT IN ('waived', 'n/a');
