const test = require('node:test');
const assert = require('node:assert/strict');
test('restock index preparation is read-only by default and apply verifies the destination',async()=>{
  const {ensureRestockIndexes}=require('../scripts/ensureRestockIndexes');let writes=0;
  const db={databaseName:'isolated',collection:()=>({listIndexes:()=>({toArray:async()=>[]}),createIndex:async()=>{writes++;}})};
  const report=await ensureRestockIndexes(db);assert.equal(writes,0);assert.ok(report.every(r=>r.status==='would-create'));
  await assert.rejects(ensureRestockIndexes(db,{apply:true,databaseName:'wrong'}),/destino/);assert.equal(writes,0);
  await ensureRestockIndexes(db,{apply:true,databaseName:'isolated'});assert.equal(writes,report.length);
});
test('new engagement models never auto-create secondary indexes', () => {
  for (const model of ['FavoriteList', 'RestockAlert', 'RestockQuota'])
    assert.equal(require(`../models/${model}`).schema.options.autoIndex, false);
});
const { issueToken, tokenHash } = require('../services/restockTokens');
test('restock tokens are random and only digests are used for lookup', () => {
  const first = issueToken();
  assert.match(first.token, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, first.hash);
  assert.notEqual(first.hash, issueToken().hash);
  assert.equal(tokenHash(first.token), first.hash);
  assert.equal(tokenHash({}), null);
  assert.equal(tokenHash('bad'), null);
});
