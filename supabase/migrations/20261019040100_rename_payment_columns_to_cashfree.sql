-- Apply only after deploying the Cashfree-column application handlers and
-- allowing requests from the previous deployment to finish.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.payments IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.payments
    WHERE cashfree_order_id IS DISTINCT FROM razorpay_order_id
       OR cashfree_payment_id IS DISTINCT FROM razorpay_payment_id) THEN
    RAISE EXCEPTION 'Payment identifier copies disagree; refusing to rename';
  END IF;
END;
$$;
DROP TRIGGER sync_cashfree_payment_columns ON public.payments;
DROP FUNCTION public.sync_cashfree_payment_columns();
-- Discard only the temporary copies, then rename the original columns. This
-- preserves the original column metadata, constraints, and identifiers.
ALTER TABLE public.payments DROP COLUMN cashfree_order_id;
ALTER TABLE public.payments DROP COLUMN cashfree_payment_id;
ALTER TABLE public.payments RENAME COLUMN razorpay_order_id TO cashfree_order_id;
ALTER TABLE public.payments RENAME COLUMN razorpay_payment_id TO cashfree_payment_id;
NOTIFY pgrst, 'reload schema';
COMMIT;
