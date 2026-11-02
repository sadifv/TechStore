const test=require('node:test'),assert=require('node:assert/strict');
test('review query indexes require explicit destination and never apply by default',async()=>{
  const {ensureReviewIndexes}=require('../scripts/ensureReviewIndexes');let writes=0;const db={databaseName:'test',collection:()=>({listIndexes:()=>({toArray:async()=>[]}),createIndex:async()=>{writes++;}})};
  assert.ok((await ensureReviewIndexes(db)).every(a=>a.status==='would-create'));assert.equal(writes,0);
  await assert.rejects(ensureReviewIndexes(db,{apply:true,databaseName:'other'}),/destino/);assert.equal(writes,0);
  await ensureReviewIndexes(db,{apply:true,databaseName:'test'});assert.equal(writes,2);
  for(const model of ['ProductReview','AddressBook'])assert.equal(require(`../models/${model}`).schema.options.autoIndex,false);
});
