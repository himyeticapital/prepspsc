-- Expand first so the previous deployment can finish in-flight requests.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.payments ADD COLUMN cashfree_order_id text;
ALTER TABLE public.payments ADD COLUMN cashfree_payment_id text;
UPDATE public.payments SET cashfree_order_id = razorpay_order_id,
                           cashfree_payment_id = razorpay_payment_id;

CREATE FUNCTION public.sync_cashfree_payment_columns() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.cashfree_order_id IS NOT NULL AND NEW.razorpay_order_id IS NOT NULL
        AND NEW.cashfree_order_id IS DISTINCT FROM NEW.razorpay_order_id)
       OR (NEW.cashfree_payment_id IS NOT NULL AND NEW.razorpay_payment_id IS NOT NULL
        AND NEW.cashfree_payment_id IS DISTINCT FROM NEW.razorpay_payment_id) THEN
      RAISE EXCEPTION 'Conflicting legacy and Cashfree identifiers';
    END IF;
    NEW.cashfree_order_id := COALESCE(NEW.cashfree_order_id, NEW.razorpay_order_id);
    NEW.razorpay_order_id := NEW.cashfree_order_id;
    NEW.cashfree_payment_id := COALESCE(NEW.cashfree_payment_id, NEW.razorpay_payment_id);
    NEW.razorpay_payment_id := NEW.cashfree_payment_id;
  ELSE
    IF NEW.cashfree_order_id IS DISTINCT FROM OLD.cashfree_order_id THEN
      IF NEW.razorpay_order_id IS DISTINCT FROM OLD.razorpay_order_id
         AND NEW.razorpay_order_id IS DISTINCT FROM NEW.cashfree_order_id THEN
        RAISE EXCEPTION 'Conflicting legacy and Cashfree order identifiers';
      END IF;
      NEW.razorpay_order_id := NEW.cashfree_order_id;
    ELSE
      NEW.cashfree_order_id := NEW.razorpay_order_id;
    END IF;
    IF NEW.cashfree_payment_id IS DISTINCT FROM OLD.cashfree_payment_id THEN
      IF NEW.razorpay_payment_id IS DISTINCT FROM OLD.razorpay_payment_id
         AND NEW.razorpay_payment_id IS DISTINCT FROM NEW.cashfree_payment_id THEN
        RAISE EXCEPTION 'Conflicting legacy and Cashfree payment identifiers';
      END IF;
      NEW.razorpay_payment_id := NEW.cashfree_payment_id;
    ELSE
      NEW.cashfree_payment_id := NEW.razorpay_payment_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sync_cashfree_payment_columns
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_cashfree_payment_columns();
NOTIFY pgrst, 'reload schema';
COMMIT;
