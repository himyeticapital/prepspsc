-- Run between expansion and final rename. Exercises compatibility on a
-- temporary table; no real payment rows or sequence values are changed.
BEGIN;
CREATE TEMP TABLE payment_column_test (LIKE public.payments INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE TRIGGER sync_cashfree_payment_columns BEFORE INSERT OR UPDATE ON payment_column_test
FOR EACH ROW EXECUTE FUNCTION public.sync_cashfree_payment_columns();
DO $$
DECLARE row_data record;
BEGIN
  INSERT INTO payment_column_test (id, user_id, razorpay_order_id, razorpay_payment_id)
    VALUES (-1, '00000000-0000-4000-8000-000000000001', 'legacy-order', 'legacy-payment');
  SELECT * INTO row_data FROM payment_column_test WHERE id = -1;
  IF row_data.cashfree_order_id <> 'legacy-order' OR row_data.cashfree_payment_id <> 'legacy-payment' THEN
    RAISE EXCEPTION 'Legacy insert was not synchronized';
  END IF;
  INSERT INTO payment_column_test (id, user_id, cashfree_order_id, cashfree_payment_id)
    VALUES (-2, '00000000-0000-4000-8000-000000000001', 'cashfree-order', 'cashfree-payment');
  SELECT * INTO row_data FROM payment_column_test WHERE id = -2;
  IF row_data.razorpay_order_id <> 'cashfree-order' OR row_data.razorpay_payment_id <> 'cashfree-payment' THEN
    RAISE EXCEPTION 'Cashfree insert was not synchronized';
  END IF;
  UPDATE payment_column_test SET cashfree_order_id = 'new-order', cashfree_payment_id = 'new-payment' WHERE id = -1;
  SELECT * INTO row_data FROM payment_column_test WHERE id = -1;
  IF row_data.razorpay_order_id <> 'new-order' OR row_data.razorpay_payment_id <> 'new-payment' THEN
    RAISE EXCEPTION 'Cashfree update was not synchronized';
  END IF;
  UPDATE payment_column_test SET razorpay_order_id = 'old-client-order', razorpay_payment_id = NULL WHERE id = -1;
  SELECT * INTO row_data FROM payment_column_test WHERE id = -1;
  IF row_data.cashfree_order_id <> 'old-client-order' OR row_data.cashfree_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy update/null was not synchronized';
  END IF;
  BEGIN
    UPDATE payment_column_test SET cashfree_order_id = 'conflict-new', razorpay_order_id = 'conflict-old' WHERE id = -1;
    RAISE EXCEPTION USING ERRCODE = 'assert_failure', MESSAGE = 'Conflicting identifiers were accepted';
  EXCEPTION WHEN raise_exception THEN
    NULL; -- The synchronization function correctly refused the conflict.
  END;
END;
$$;
ROLLBACK;
