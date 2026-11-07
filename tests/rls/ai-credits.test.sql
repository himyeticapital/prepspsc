-- AI credits wallet test (prepaid credits for the paid "Better answer" upgrade).
-- Run the whole file in one go as postgres. It ALWAYS ends with an exception, so every change it
-- makes is rolled back. The exception message is the report: "0 failure(s)" means it passes.

DO $test$
DECLARE
  failures text[] := '{}';
  alice uuid := gen_random_uuid();
  bob uuid := gen_random_uuid();
  r jsonb;
  n integer;
  bal integer;
  state text;
  fn text;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) VALUES
    (alice, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cr-a-' || alice || '@prepspsc-test.local', '{}'::jsonb, now(), now()),
    (bob, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cr-b-' || bob || '@prepspsc-test.local', '{}'::jsonb, now(), now());

  -- 1. A top-up adds credits once, even if Cashfree tells us twice
  BEGIN
    r := public.ai_credit_add(alice, 5000, 'topup', 'test_order_' || alice);
    IF (r->>'balance_paise')::int <> 5000 OR (r->>'applied')::boolean IS NOT TRUE THEN
      failures := failures || ('first top-up: ' || r::text);
    END IF;
    r := public.ai_credit_add(alice, 5000, 'topup', 'test_order_' || alice);
    IF (r->>'balance_paise')::int <> 5000 OR (r->>'applied')::boolean IS NOT FALSE THEN
      failures := failures || ('repeated top-up was not ignored: ' || r::text);
    END IF;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('top-up: ' || SQLERRM); END;

  -- 2. A spend takes the price off; a spend larger than the balance is refused and takes nothing
  BEGIN
    r := public.ai_credit_spend(alice, 500, 'test_spend_1_' || alice);
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'balance_paise')::int <> 4500 THEN
      failures := failures || ('spend: ' || r::text);
    END IF;
    r := public.ai_credit_spend(alice, 9999, 'test_spend_big_' || alice);
    IF (r->>'ok')::boolean IS NOT FALSE OR (r->>'balance_paise')::int <> 4500 THEN
      failures := failures || ('overspend was not refused: ' || r::text);
    END IF;
    r := public.ai_credit_spend(bob, 500, 'test_spend_bob_' || bob);
    IF (r->>'ok')::boolean IS NOT FALSE OR (r->>'balance_paise')::int <> 0 THEN
      failures := failures || ('spend with no wallet: ' || r::text);
    END IF;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('spend: ' || SQLERRM); END;

  -- 3. The same charge can't be taken twice
  BEGIN
    r := public.ai_credit_spend(alice, 500, 'test_spend_1_' || alice);
    SELECT balance_paise INTO bal FROM public.ai_credit_wallets WHERE user_id = alice;
    IF bal <> 4500 THEN failures := failures || ('repeated charge was taken twice, balance ' || bal); END IF;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('repeat spend: ' || SQLERRM); END;

  -- 4. A failed answer is refunded once, only for a real charge, only for the charged amount
  BEGIN
    r := public.ai_credit_add(alice, 500, 'refund', 'test_spend_1_' || alice);
    r := public.ai_credit_add(alice, 500, 'refund', 'test_spend_1_' || alice);
    SELECT balance_paise INTO bal FROM public.ai_credit_wallets WHERE user_id = alice;
    IF bal <> 5000 THEN failures := failures || ('refund balance should be 5000, is ' || bal); END IF;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('refund: ' || SQLERRM); END;
  BEGIN
    r := public.ai_credit_add(alice, 500, 'refund', 'no_such_charge');
    failures := failures || 'refunded a charge that never happened'::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    PERFORM public.ai_credit_spend(alice, 500, 'test_spend_2_' || alice);
  EXCEPTION WHEN OTHERS THEN failures := failures || ('second spend: ' || SQLERRM); END;
  BEGIN
    r := public.ai_credit_add(alice, 5000, 'refund', 'test_spend_2_' || alice);
    failures := failures || 'refunded more than was charged'::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    r := public.ai_credit_add(bob, 500, 'refund', 'test_spend_2_' || alice);
    failures := failures || 'refunded someone else''s charge'::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 5. Bad amounts are rejected
  BEGIN
    r := public.ai_credit_add(alice, -100, 'topup', 'test_neg_' || alice);
    failures := failures || 'accepted a negative top-up'::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    r := public.ai_credit_spend(alice, 0, 'test_zero_' || alice);
    failures := failures || 'accepted a zero charge'::text;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 6. Every change is in the ledger with the balance after it
  SELECT count(*) INTO n FROM public.ai_credit_ledger WHERE user_id = alice;
  IF n <> 4 THEN failures := failures || ('ledger should have 4 rows for alice, has ' || n); END IF;
  SELECT balance_after_paise INTO bal FROM public.ai_credit_ledger WHERE user_id = alice ORDER BY id DESC LIMIT 1;
  IF bal <> 4500 THEN failures := failures || ('last ledger balance should be 4500, is ' || coalesce(bal::text, 'null')); END IF;

  -- Act as Alice (signed in) for the next checks
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', alice)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- 7. Alice can see her own wallet and history, not Bob's
  BEGIN
    SELECT count(*) INTO n FROM public.ai_credit_wallets WHERE user_id = alice;
    IF n <> 1 THEN failures := failures || 'a user cannot see their own wallet'::text; END IF;
    SELECT count(*) INTO n FROM public.ai_credit_ledger WHERE user_id = alice;
    IF n <> 4 THEN failures := failures || 'a user cannot see their own credit history'::text; END IF;
    SELECT count(*) INTO n FROM public.ai_credit_ledger WHERE user_id <> alice;
    IF n <> 0 THEN failures := failures || 'a user can see other users'' credit history'::text; END IF;
  EXCEPTION WHEN OTHERS THEN failures := failures || ('own wallet: ' || SQLERRM); END;

  -- 8. Alice can't give herself credits, directly or through the functions
  BEGIN
    UPDATE public.ai_credit_wallets SET balance_paise = 99999 WHERE user_id = alice;
    failures := failures || 'a user edited their own balance'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' THEN failures := failures || ('edit balance: ' || SQLSTATE || ' ' || SQLERRM); END IF;
  END;
  BEGIN
    INSERT INTO public.ai_credit_ledger (user_id, delta_paise, reason, reference, balance_after_paise)
    VALUES (alice, 99999, 'adjustment', 'self_gift', 99999);
    failures := failures || 'a user wrote to the credit ledger'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' THEN failures := failures || ('write ledger: ' || SQLSTATE || ' ' || SQLERRM); END IF;
  END;
  FOREACH fn IN ARRAY ARRAY['ai_credit_add', 'ai_credit_spend'] LOOP
    BEGIN
      IF fn = 'ai_credit_add' THEN
        r := public.ai_credit_add(alice, 99999, 'topup', 'self_topup_' || alice);
      ELSE
        r := public.ai_credit_spend(bob, 1, 'grief_' || bob);
      END IF;
      failures := failures || ('a signed-in user can call ' || fn);
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE <> '42501' THEN failures := failures || (fn || ': ' || SQLSTATE || ' ' || SQLERRM); END IF;
    END;
  END LOOP;
  EXECUTE 'RESET ROLE';

  -- 9. Logged-out visitors can't read wallets
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    SELECT count(*) INTO n FROM public.ai_credit_wallets;
    IF n <> 0 THEN failures := failures || 'logged-out visitors can read wallets'::text; END IF;
  EXCEPTION WHEN OTHERS THEN
    state := SQLSTATE;
    IF state <> '42501' THEN failures := failures || ('anon read: ' || state || ' ' || SQLERRM); END IF;
  END;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'AI CREDITS TEST (rolled back): % failure(s)%', coalesce(array_length(failures, 1), 0),
    CASE WHEN coalesce(array_length(failures, 1), 0) = 0 THEN '' ELSE E'\n- ' || array_to_string(failures, E'\n- ') END;
END
$test$;
