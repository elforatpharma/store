CREATE OR REPLACE FUNCTION public.bundle_total_for_quantity(p_product_id text, p_quantity integer, p_unit_price numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SET search_path = public AS $bundle$
DECLARE v_dp numeric[]; v_n integer; v_offer record;
BEGIN
    IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity > 100 OR p_unit_price IS NULL OR p_unit_price < 0 THEN RAISE EXCEPTION 'ORDER_INVALID_ITEMS'; END IF;
    IF p_quantity = 0 THEN RETURN 0; END IF;
    v_dp := array_fill(0::numeric, ARRAY[p_quantity + 1]); v_dp[1] := 0;
    FOR v_n IN 1..p_quantity LOOP
        v_dp[v_n + 1] := v_dp[v_n] + p_unit_price;
        FOR v_offer IN SELECT quantity, bundle_price FROM public.product_bundle_offers
          WHERE product_id::text = p_product_id AND is_active = true AND quantity > 0 AND quantity <= v_n AND bundle_price >= 0
        LOOP
            v_dp[v_n + 1] := least(v_dp[v_n + 1], v_dp[v_n - v_offer.quantity + 1] + v_offer.bundle_price);
        END LOOP;
    END LOOP;
    RETURN round(v_dp[p_quantity + 1], 2);
END;
$bundle$;
REVOKE ALL ON FUNCTION public.bundle_total_for_quantity(text, integer, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bundle_total_for_quantity(text, integer, numeric) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.orders_validate_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_item      jsonb;
  v_price     numeric;
  v_active    boolean;
  v_qty       int;
  v_subtotal  numeric := 0;
  v_discount  numeric := 0;
  v_fee       numeric;
  v_threshold numeric;
  v_pct       numeric;
  v_expected  numeric;
  v_gift_id   text;
  v_trig_name text;
  v_trig_qty  int;
  v_allowed   numeric;
begin
  -- بيتخطى: الأدمن، service_role، والاتصالات الداخلية (من غير role). أي anon أو
  -- authenticated عادي بيتفحص.
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if new.items is null
     or jsonb_typeof(new.items::jsonb) <> 'array'
     or jsonb_array_length(new.items::jsonb) = 0 then
    raise exception 'ORDER_INVALID_ITEMS';
  end if;

  -- 3.1) الإجمالي الفرعي من أسعار المنتجات الحقيقية
  for v_item in select elem from jsonb_array_elements(new.items::jsonb) as elem loop
    v_qty := coalesce((v_item->>'qty')::int, 1);
    if v_qty < 1 or v_qty > 100 then
      raise exception 'ORDER_INVALID_ITEMS';
    end if;

    if coalesce((v_item->>'isGift')::boolean, false) then
      -- الهدية لازم تكون id بالشكل gift_<id> وموجودة ونشطة في جدول gifts
      v_gift_id := regexp_replace(coalesce(v_item->>'id', ''), '^gift_', '');
      if coalesce(v_item->>'id', '') !~ '^gift_' then
        raise exception 'ORDER_INVALID_GIFT: %', v_item->>'id';
      end if;
      select g.trigger_product_name, greatest(coalesce(g.trigger_qty, 1), 1)
        into v_trig_name, v_trig_qty
        from public.gifts g
       where g.id::text = v_gift_id and g.is_active;
      if not found then
        raise exception 'ORDER_INVALID_GIFT: %', v_item->>'id';
      end if;

      -- شرط الهدية (نفس منطق الموقع في checkOffers): لازم المنتج المشترط (اسمه بيحتوي
      -- trigger_product_name) يكون في الطلب بكمية >= trigger_qty، وكمية الهدية
      -- ماتزيدش عن floor(كمية المنتج / trigger_qty). قبل كده أي هدية نشطة كانت بتعدّي
      -- من غير شراء المنتج المشترط وبأي كمية لحد 100.
      select coalesce(max(floor(coalesce(nullif(e->>'qty', '')::numeric, 1) / v_trig_qty)), 0)
        into v_allowed
        from jsonb_array_elements(new.items::jsonb) e
        join public.products p on p.id::text = e->>'id'
       where not coalesce((e->>'isGift')::boolean, false)
         and position(lower(coalesce(v_trig_name, '')) in lower(p.name)) > 0;
      if v_qty > v_allowed then
        raise exception 'ORDER_INVALID_GIFT: %', v_item->>'id';
      end if;
      continue;
    end if;

    select p.price, coalesce(p.is_active, false)
      into v_price, v_active
      from public.products p
     where p.id::text = v_item->>'id';
    if not found or v_price is null then
      raise exception 'ORDER_UNKNOWN_PRODUCT: %', v_item->>'id';
    end if;
    if not coalesce(v_active, false) then
      raise exception 'ORDER_PRODUCT_INACTIVE: %', v_item->>'id';
    end if;
    v_subtotal := v_subtotal + public.bundle_total_for_quantity(v_item->>'id', v_qty, v_price);
  end loop;

  if v_subtotal <= 0 then
    raise exception 'ORDER_INVALID_ITEMS';
  end if;

  -- 3.2) الكوبون: التحقق وزيادة used_count في خطوة واحدة atomic (UPDATE ... WHERE).
  if new.coupon_code is not null and new.coupon_code <> '' then
    update public.coupons c
       set used_count = coalesce(c.used_count, 0) + 1
     where c.code = new.coupon_code
       and c.is_active
       and (c.expiry_date is null or c.expiry_date >= current_date)
       and (c.max_uses is null or coalesce(c.used_count, 0) < c.max_uses)
       and (c.min_amount is null or v_subtotal >= c.min_amount)
    returning c.discount_percentage into v_pct;

    if not found or coalesce(v_pct, 0) <= 0 then
      raise exception 'ORDER_INVALID_COUPON: %', new.coupon_code;
    end if;
    v_discount := round(v_subtotal * v_pct / 100, 2);
  end if;

  -- 3.3) الشحن: سعر المحافظة، ومجاني لو الإجمالي الفرعي وصل لحد الشحن المجاني
  -- الحد: settings.data (زي الموقع) ← عمود settings.free_shipping_threshold ← 1000
  begin
    select (s.data::jsonb ->> 'free_shipping_threshold')::numeric
      into v_threshold from public.settings s where s.id = 1;
  exception when others then
    v_threshold := null;
  end;
  if v_threshold is null or v_threshold = 0 then
    begin
      execute 'select free_shipping_threshold from public.settings limit 1' into v_threshold;
    exception when others then
      v_threshold := null;
    end;
  end if;
  v_threshold := coalesce(nullif(v_threshold, 0), 1000);

  select r.fee into v_fee from public.shipping_rates r where r.governorate = new.governorate;
  if not found then
    raise exception 'ORDER_BAD_GOVERNORATE: %', coalesce(new.governorate, '');
  end if;
  if v_subtotal >= v_threshold then
    v_fee := 0;
  end if;

  -- 3.4) المقارنة (سماح 0.01 جنيه لفروق التقريب)
  v_expected := round(v_subtotal - v_discount + v_fee, 2);
  if abs(coalesce(new.total, -1) - v_expected) > 0.01 then
    raise exception 'ORDER_TOTAL_MISMATCH: expected %, got %', v_expected, new.total;
  end if;

  -- القيم دي بتتكتب من السيرفر مش من المتصفح
  new.shipping_fee := v_fee;
  new.discount_amount := v_discount;
  new.payment_status := 'pending';
  new.status_code := 'pending';
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_order_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  declare
    item jsonb; computed_subtotal numeric := 0; item_price numeric; item_qty numeric;
    is_gift boolean; product_id text; discount_pct numeric := 0; discount_amt numeric; final_total numeric;
  begin
    if new.items is not null then
      for item in select * from jsonb_array_elements(new.items) loop
        is_gift := coalesce((item->>'isGift')::boolean, false);
        item_qty := coalesce((item->>'qty')::numeric, 1);
        product_id := item->>'id';
        if is_gift then item_price := 0;
        else
          select price into item_price from products where id::text = product_id;
          item_price := coalesce(item_price, 0);
        end if;
        computed_subtotal := computed_subtotal + public.bundle_total_for_quantity(product_id, item_qty::int, item_price);
      end loop;
    end if;
    if new.coupon_code is not null and new.coupon_code <> '' then
      select discount_percentage into discount_pct from coupons
      where code = new.coupon_code and is_active = true
        and (expiry_date is null or expiry_date >= current_date);
    end if;
    discount_pct := coalesce(discount_pct, 0);
    discount_amt := round(computed_subtotal * discount_pct / 100, 2);
    final_total := greatest(computed_subtotal - discount_amt, 0) + coalesce(new.shipping_fee, 0);
    new.total := final_total;
    new.discount_amount := discount_amt;
    return new;
  end;
  $function$
;
