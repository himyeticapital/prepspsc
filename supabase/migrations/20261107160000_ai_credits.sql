-- AI credits: a prepaid wallet that pays for the optional "Better answer" upgrade.
--
-- Every AI feature runs on the free basic model. A student who wants a stronger answer spends
-- credits (topped up through Cashfree). Amounts are stored in paise (₹1 = 100 paise).
--
-- Safety rules:
--   * Students can READ their own wallet and history. They can never write to either.
--   * Only the server (service role) can add or spend credits, through the two functions below.
--   * Each top-up, charge and refund has a unique reference, so a retried webhook or request
--     can never add or take credits twice.
--   * A refund must match a real charge for the same student and the same amount.

CREATE TABLE IF NOT EXISTS public.ai_credit_wallets (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance_paise integer NOT NULL DEFAULT 0 CHECK (balance_paise >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_credit_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta_paise integer NOT NULL CHECK (delta_paise <> 0),
  reason text NOT NULL CHECK (reason IN ('topup', 'spend', 'refund', 'adjustment')),
  reference text NOT NULL CHECK (length(reference) BETWEEN 1 AND 200),
  balance_after_paise integer NOT NULL CHECK (balance_after_paise >= 0),
  note text CHECK (note IS NULL OR length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_credit_ledger_reason_reference_key UNIQUE (reason, reference)
);

CREATE INDEX IF NOT EXISTS ai_credit_ledger_user_created_idx
  ON public.ai_credit_ledger (user_id, created_at DESC);

ALTER TABLE public.ai_credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own credit wallet" ON public.ai_credit_wallets;
CREATE POLICY "Users read own credit wallet" ON public.ai_credit_wallets
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Admins read credit wallets" ON public.ai_credit_wallets;
CREATE POLICY "Admins read credit wallets" ON public.ai_credit_wallets
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

DROP POLICY IF EXISTS "Users read own credit history" ON public.ai_credit_ledger;
CREATE POLICY "Users read own credit history" ON public.ai_credit_ledger
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Admins read credit history" ON public.ai_credit_ledger;
CREATE POLICY "Admins read credit history" ON public.ai_credit_ledger
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

REVOKE ALL ON public.ai_credit_wallets, public.ai_credit_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_credit_wallets, public.ai_credit_ledger TO authenticated;
GRANT ALL ON public.ai_credit_wallets, public.ai_credit_ledger TO service_role;

-- Add credits: a top-up, a refund of a failed charge, or an admin adjustment.
-- Returns {"balance_paise": n, "applied": true|false}. applied=false means this reference was
-- already used, so nothing changed.
CREATE OR REPLACE FUNCTION public.ai_credit_add(
  p_user_id uuid,
  p_amount_paise integer,
  p_reason text,
  p_reference text,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance integer;
  v_charge integer;
  v_id bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user is required' USING ERRCODE = '22023';
  END IF;
  IF p_amount_paise IS NULL OR p_amount_paise <= 0 OR p_amount_paise > 1000000 THEN
    RAISE EXCEPTION 'invalid credit amount' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('topup', 'refund', 'adjustment') THEN
    RAISE EXCEPTION 'invalid credit reason' USING ERRCODE = '22023';
  END IF;
  IF p_reference IS NULL OR length(p_reference) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid credit reference' USING ERRCODE = '22023';
  END IF;

  IF p_reason = 'refund' THEN
    SELECT -l.delta_paise INTO v_charge
    FROM public.ai_credit_ledger l
    WHERE l.reason = 'spend' AND l.reference = p_reference AND l.user_id = p_user_id;
    IF v_charge IS NULL THEN
      RAISE EXCEPTION 'no matching charge to refund' USING ERRCODE = '22023';
    END IF;
    IF p_amount_paise <> v_charge THEN
      RAISE EXCEPTION 'a refund must equal the charge' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Create the wallet if needed, then lock it so concurrent calls for this student run one at a time.
  INSERT INTO public.ai_credit_wallets (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT w.balance_paise INTO v_balance FROM public.ai_credit_wallets w
  WHERE w.user_id = p_user_id FOR UPDATE;

  INSERT INTO public.ai_credit_ledger (user_id, delta_paise, reason, reference, balance_after_paise, note)
  VALUES (p_user_id, p_amount_paise, p_reason, p_reference, v_balance + p_amount_paise, p_note)
  ON CONFLICT (reason, reference) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('balance_paise', v_balance, 'applied', false);
  END IF;

  UPDATE public.ai_credit_wallets w
  SET balance_paise = v_balance + p_amount_paise, updated_at = now()
  WHERE w.user_id = p_user_id;

  RETURN jsonb_build_object('balance_paise', v_balance + p_amount_paise, 'applied', true);
END;
$$;

-- Spend credits for one paid answer. Never goes below zero.
-- Returns {"ok": true, "balance_paise": n, "applied": true|false} when paid (applied=false means
-- this charge reference was already paid), or {"ok": false, "balance_paise": n} when the
-- balance is too low (nothing is taken).
CREATE OR REPLACE FUNCTION public.ai_credit_spend(
  p_user_id uuid,
  p_amount_paise integer,
  p_reference text,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance integer;
  v_id bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user is required' USING ERRCODE = '22023';
  END IF;
  IF p_amount_paise IS NULL OR p_amount_paise <= 0 OR p_amount_paise > 100000 THEN
    RAISE EXCEPTION 'invalid charge amount' USING ERRCODE = '22023';
  END IF;
  IF p_reference IS NULL OR length(p_reference) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid charge reference' USING ERRCODE = '22023';
  END IF;

  SELECT w.balance_paise INTO v_balance FROM public.ai_credit_wallets w
  WHERE w.user_id = p_user_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.ai_credit_ledger l
             WHERE l.reason = 'spend' AND l.reference = p_reference AND l.user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', true, 'balance_paise', coalesce(v_balance, 0), 'applied', false);
  END IF;

  IF v_balance IS NULL OR v_balance < p_amount_paise THEN
    RETURN jsonb_build_object('ok', false, 'balance_paise', coalesce(v_balance, 0));
  END IF;

  INSERT INTO public.ai_credit_ledger (user_id, delta_paise, reason, reference, balance_after_paise, note)
  VALUES (p_user_id, -p_amount_paise, 'spend', p_reference, v_balance - p_amount_paise, p_note)
  RETURNING id INTO v_id;

  UPDATE public.ai_credit_wallets w
  SET balance_paise = v_balance - p_amount_paise, updated_at = now()
  WHERE w.user_id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'balance_paise', v_balance - p_amount_paise, 'applied', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ai_credit_add(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_credit_spend(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_credit_add(uuid, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_credit_spend(uuid, integer, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
