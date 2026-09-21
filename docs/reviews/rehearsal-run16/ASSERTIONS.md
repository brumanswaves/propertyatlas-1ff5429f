# Retained assertion excerpts

Synthetic local execution only. These excerpts document what the retained scripts asserted. They are not new executions or independently issued certificates. Credentials, initialization and browser-session setup are omitted. Responses are separately included in the allowlisted persistence capture.

## scripts/verify-rehearsal-followup.mjs

Original local script SHA256: `fb622e0406cdd072c1b72a177f3f66b7907191f6986b3f56597475ff073dae72`. Excerpt begins at line 12.

```js
const own=await clients.a.rpc('read_customer_investigation',{p_parcel_id:'csg:lpi:c00000000000004200000'});assert.equal(own.error,null);
const otherReport=await clients.b.rpc('read_investigation_review',{p_order_id:delivery.orderId,p_version_id:delivery.versionId});assert(otherReport.error||!otherReport.data);
for(const asset of own.data.assets){const denied=await clients.b.storage.from('erf-files').download(asset.storage_path);assert(denied.error);}

```

## scripts/verify-rehearsal-followup.mjs

Original local script SHA256: `fb622e0406cdd072c1b72a177f3f66b7907191f6986b3f56597475ff073dae72`. Excerpt begins at line 32.

```js
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await page.goto(access.url+'/orders?report='+delivery.orderId);
 assert.equal(await page.locator('[data-review-version="'+delivery.versionId+'"]').count(),0);

```

## scripts/verify-rehearsal-interrupted-upload.mjs

Original local script SHA256: `14c7473315f4511e87d554d1df243843679748ac5e666c7d21451f186cfde8d5`. Excerpt begins at line 40.

```js
 const after=await clients.a.rpc('read_customer_investigation',{p_parcel_id:'csg:lpi:c00000000000004200000'});
 assert.deepEqual(after.data.assets.map(a=>a.id).sort(),before.data.assets.map(a=>a.id).sort());
 assert.equal(after.data.assets.find(a=>a.id===original.id).metadata.sgReceiptSha256,original.metadata.sgReceiptSha256);

```

## scripts/verify-isolated-rehearsal.mjs

Original local script SHA256: `15c9822756d705bdc99f362aec551d1309ced776b26b3e5cfa921f0919bfe32d`. Excerpt begins at line 508.

```js
    const first=await send(event); assert.equal(first.status,200); assert.equal(first.body.recorded,true);
    const duplicate=await send(event); assert.equal(duplicate.body.orderId,first.body.orderId);
    const row=must(await adminClient.from('report_orders').select('id,user_id,parcel_id,status_enum').eq('id',first.body.orderId).single());
    assert.equal(row.user_id,ids[actor]); assert.equal(row.parcel_id,parcel); assert.equal(row.status_enum,'paid');

```

## scripts/verify-isolated-rehearsal.mjs

Original local script SHA256: `15c9822756d705bdc99f362aec551d1309ced776b26b3e5cfa921f0919bfe32d`. Excerpt begins at line 683.

```js
  const persisted = await rpc("a", "read_investigation_review", { p_order_id: orderA, p_version_id: approved.id });
  assert(persisted.delivered_at); assert.equal(createHash("sha256").update(JSON.stringify(persisted.report_assembly)).digest("hex"), frozenHash);
  const current = await rpc("a", "read_customer_investigation", { p_parcel_id: parcelA });
  await rpc("a", "patch_saved_property_user_data_if_unchanged", { p_parcel_id: parcelA,
    p_user_data_patch: { easyErfInvestigation: { ...current.userData.easyErfInvestigation, identityStatus: "uncertain" } }, p_expected: current.userData });
  const later = await rpc("a", "read_investigation_review", { p_order_id: orderA, p_version_id: approved.id });
  assert.equal(createHash("sha256").update(JSON.stringify(later.report_assembly)).digest("hex"), frozenHash);
  const assets = current.assets;
  for (const actor of ["a", "b", "stranger", "worker"]) {
    for (const asset of assets) {
      const read = await fetch(`${appUrl}/api/investigations/asset`, { method: "POST", headers: {
        Authorization: "[local caller credential omitted]", "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderA, assetId: asset.id, versionId: approved.id }) });
      const permitted = actor === "worker" || (actor === "a" && asset.asset_category === "sg_diagram");
      assert.equal(read.status, permitted ? 200 : 403, `${actor} ${asset.asset_category}`);
      if (permitted) assert.equal(createHash("sha256").update(Buffer.from(await read.arrayBuffer())).digest("hex"), (asset.checksum_sha256 ?? asset.metadata.sgReceiptSha256));
    }
  }

```
