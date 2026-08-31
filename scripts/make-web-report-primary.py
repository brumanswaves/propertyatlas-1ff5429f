from pathlib import Path


def replace_once(path: str, old: str, new: str):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


# Human Review v2 supersedes the historical PDF-required mark_ready rule.
# A validated structured web report is required; a PDF is optional but, when
# supplied, still has to be the exact private customer-order object.
reopen = Path("supabase/migrations/20260831142610_reopen_easy_erf_human_review.sql").read_text()
start = reopen.index("create or replace function public.transition_easy_erf_report_order(")
end_marker = "comment on function public.transition_easy_erf_report_order(uuid, text, uuid, text, text)\nis '"
end_start = reopen.index(end_marker, start)
end_semicolon = reopen.index(";", end_start) + 1
function_sql = reopen[start:end_semicolon]

old_ready = '''    when 'mark_ready' then
      if v_from_status <> 'processing' then
        raise exception 'Only processing orders can be marked ready';
      end if;
      if v_order.user_id is null then
        raise exception 'A matched customer account is required before report delivery';
      end if;
      if nullif(btrim(coalesce(p_pdf_storage_path, '')), '') is null then
        raise exception 'A report PDF storage path is required before marking ready';
      end if;

      v_expected_pdf_path := v_order.user_id::text
        || '/paid-reports/'
        || p_order_id::text
        || '/report.pdf';

      if btrim(p_pdf_storage_path) <> v_expected_pdf_path then
        raise exception 'Report PDF storage path does not match the customer order';
      end if;

      if not exists (
        select 1
        from storage.objects
        where bucket_id = 'erf-files'
          and name = v_expected_pdf_path
      ) then
        raise exception 'Report PDF is not present in private storage';
      end if;

      v_to_status := 'ready';
      update public.report_orders
      set status = 'ready',
          status_enum = 'complete'::public.report_order_status,
          pdf_storage_path = v_expected_pdf_path,
          failure_reason = null,
          completed_at = now(),
          updated_at = now()
      where id = p_order_id
      returning * into v_order;
'''
new_ready = '''    when 'mark_ready' then
      if v_from_status <> 'processing' then
        raise exception 'Only processing orders can be marked ready';
      end if;
      if v_order.review_content is null then
        raise exception 'A structured Human Review web report is required before marking ready';
      end if;

      if nullif(btrim(coalesce(p_pdf_storage_path, '')), '') is not null then
        if v_order.user_id is null then
          raise exception 'A matched customer account is required before private PDF delivery';
        end if;

        v_expected_pdf_path := v_order.user_id::text
          || '/paid-reports/'
          || p_order_id::text
          || '/report.pdf';

        if btrim(p_pdf_storage_path) <> v_expected_pdf_path then
          raise exception 'Report PDF storage path does not match the customer order';
        end if;

        if not exists (
          select 1
          from storage.objects
          where bucket_id = 'erf-files'
            and name = v_expected_pdf_path
        ) then
          raise exception 'Report PDF is not present in private storage';
        end if;
      else
        v_expected_pdf_path := null;
      end if;

      v_to_status := 'ready';
      update public.report_orders
      set status = 'ready',
          status_enum = 'complete'::public.report_order_status,
          pdf_storage_path = coalesce(v_expected_pdf_path, v_order.pdf_storage_path),
          failure_reason = null,
          completed_at = now(),
          updated_at = now()
      where id = p_order_id
      returning * into v_order;
'''
if function_sql.count(old_ready) != 1:
    raise SystemExit(f"transition mark_ready block mismatch: {function_sql.count(old_ready)}")
function_sql = function_sql.replace(old_ready, new_ready, 1)
old_comment = "Applies audited founder fulfillment, including an explicit ready-to-processing reopen for report replacement, using canonical report_order_status values fulfilling/complete."
new_comment = "Applies audited Human Review fulfillment using a structured web report as the ready artifact; private PDF delivery remains an optional exact-path export."
if function_sql.count(old_comment) != 1:
    raise SystemExit("transition function comment mismatch")
function_sql = function_sql.replace(old_comment, new_comment, 1)

migration_path = Path("supabase/migrations/20260831160318_controlled_human_review_product_v2.sql")
migration = migration_path.read_text()
if migration.count("\ncommit;\n") != 1:
    raise SystemExit("Human Review migration commit anchor mismatch")
migration = migration.replace("\ncommit;\n", "\n\n" + function_sql + "\n\ncommit;\n", 1)
migration_path.write_text(migration)

# Edge function no longer makes PDF mandatory for mark_ready. Database authority
# enforces that the structured report exists and validates any optional PDF.
replace_once(
    "supabase/functions/easy-erf-founder-fulfillment/index.ts",
    '''  if (action === "mark_ready" && !pdfStoragePath) {
    return json({ ok: false, error: "pdfStoragePath is required for mark_ready.", requestId }, 400);
  }
''',
    "",
)

# Founder UI gains a direct web-report ready action while preserving the exact
# private PDF uploader as an optional export path.
replace_once(
    "src/routes/admin.fulfillment.tsx",
    '''        {status === "processing" ? (
          <ReadyAction order={order} busy={busy} onUploadReport={onUploadReport} />
        ) : null}
''',
    '''        {status === "processing" ? (
          <ReadyAction
            order={order}
            busy={busy}
            onUploadReport={onUploadReport}
            onTransition={onTransition}
          />
        ) : null}
''',
)
replace_once(
    "src/routes/admin.fulfillment.tsx",
    '''function ReadyAction({
  order,
  busy,
  onUploadReport,
}: {
  order: ReportOrder;
  busy: boolean;
  onUploadReport: (order: ReportOrder, file: File) => Promise<void>;
}) {
''',
    '''function ReadyAction({
  order,
  busy,
  onUploadReport,
  onTransition,
}: {
  order: ReportOrder;
  busy: boolean;
  onUploadReport: (order: ReportOrder, file: File) => Promise<void>;
  onTransition: (
    order: ReportOrder,
    action: FulfillmentAction,
    values?: { pdfStoragePath?: string; failureReason?: string },
  ) => Promise<void>;
}) {
''',
)
replace_once(
    "src/routes/admin.fulfillment.tsx",
    '''  return (
    <div className="flex min-w-[300px] flex-1 flex-wrap items-center gap-2">
      <input
''',
    '''  return (
    <div className="flex min-w-[300px] flex-1 flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy || !order.review_content}
        onClick={() => void onTransition(order, "mark_ready")}
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        title={order.review_content ? "Deliver the structured Human-Reviewed web report" : "Save the structured web report first"}
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Mark web report ready
      </button>
      <input
''',
)

# Expand the dedicated product verifier with a brand-new paid order that becomes
# ready with structured web content and no PDF object/path.
verify = Path("scripts/verify-easy-erf-human-review-product.sql")
verify_text = verify.read_text()
anchor = '''  begin
    insert into public.human_review_requests (focus, context, status)
    values ('property_check', repeat('x', 601), 'checkout_started');
    raise exception 'Overlong customer context bypassed database constraint';
  exception
    when check_violation then null;
  end;
end
$$;
'''
proof = '''  begin
    insert into public.human_review_requests (focus, context, status)
    values ('property_check', repeat('x', 601), 'checkout_started');
    raise exception 'Overlong customer context bypassed database constraint';
  exception
    when check_violation then null;
  end;
end
$$;

do $$
declare
  v_order_id uuid;
  v_row public.report_orders%rowtype;
  v_actor_id uuid := '11111111-1111-4111-8111-111111111111'::uuid;
begin
  select public.record_easy_erf_stripe_payment(
    'cs_test_web_report_only_1',
    'evt_test_web_report_only_1',
    'plink_easy_erf_test',
    null,
    null,
    null,
    'web-report@example.com',
    'Web Report Test',
    'Erf 9001',
    null,
    'zar',
    99900,
    false,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'csg:lpi:c03400140000900100000'
  ) into v_order_id;

  perform public.transition_easy_erf_report_order(
    v_order_id, 'start_review', v_actor_id, null, null
  );

  begin
    perform public.transition_easy_erf_report_order(
      v_order_id, 'mark_ready', v_actor_id, null, null
    );
    raise exception 'mark_ready accepted an empty structured Human Review report';
  exception
    when others then
      if sqlerrm = 'mark_ready accepted an empty structured Human Review report' then raise; end if;
      if sqlerrm not like '%structured Human Review web report is required%' then
        raise exception 'Unexpected missing-web-report error: %', sqlerrm;
      end if;
  end;

  update public.report_orders
  set review_focus = 'property_check',
      review_content = jsonb_build_object(
        'bottomLine', 'Reviewed bottom line',
        'known', jsonb_build_array('Known fact'),
        'potential', jsonb_build_array('Evidence-supported potential'),
        'risks', jsonb_build_array('Risk'),
        'unknowns', jsonb_build_array('Unknown'),
        'nextSteps', jsonb_build_array('Verify next step')
      ),
      reviewed_by = v_actor_id,
      review_content_updated_at = now()
  where id = v_order_id;

  select * into v_row from public.transition_easy_erf_report_order(
    v_order_id, 'mark_ready', v_actor_id, null, null
  );

  if v_row.status <> 'ready'
     or v_row.status_enum <> 'complete'::public.report_order_status
     or v_row.pdf_storage_path is not null
     or v_row.completed_at is null then
    raise exception 'Structured web report did not become ready without a PDF';
  end if;
end
$$;
'''
if verify_text.count(anchor) != 1:
    raise SystemExit(f"Human Review verifier anchor mismatch: {verify_text.count(anchor)}")
verify.write_text(verify_text.replace(anchor, proof, 1))

# Extend source guardrails so the web-first contract cannot quietly regress.
guard = Path("src/lib/payments/__tests__/easyErfHumanReviewScopeGuardrails.test.ts")
g = guard.read_text()
g = g.replace(
    'const migration = source(\n  "supabase/migrations/20260831160318_controlled_human_review_product_v2.sql",\n);',
    'const migration = source(\n  "supabase/migrations/20260831160318_controlled_human_review_product_v2.sql",\n);\nconst founderFulfillment = source("supabase/functions/easy-erf-founder-fulfillment/index.ts");',
    1,
)
old = '''  it("renders the finished review as a web report and keeps PDF secondary", () => {
    expect(orders).toContain("<HumanReviewedReport");
    expect(orders).toContain('downloading ? "Preparing PDF…" : "Download PDF"');
    expect(orders).toContain("The PDF is a secondary export, not the primary product.");
  });
'''
new = '''  it("renders the finished review as a web report and keeps PDF secondary", () => {
    expect(orders).toContain("<HumanReviewedReport");
    expect(orders).toContain('downloading ? "Preparing PDF…" : "Download PDF"');
    expect(orders).toContain("The PDF is a secondary export, not the primary product.");
    expect(migration).toContain("A structured Human Review web report is required before marking ready");
    expect(migration).toContain("pdf_storage_path = coalesce(v_expected_pdf_path, v_order.pdf_storage_path)");
    expect(founderFulfillment).not.toContain("pdfStoragePath is required for mark_ready");
    expect(founderQueue).toContain("Mark web report ready");
  });
'''
if g.count(old) != 1:
    raise SystemExit("Human Review web-first guardrail anchor mismatch")
guard.write_text(g.replace(old, new, 1))
