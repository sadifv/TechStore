const definitions=[{name:'review_public_lookup',key:{product:1,status:1,createdAt:-1,_id:-1}},{name:'review_moderation_queue',key:{status:1,updatedAt:1,_id:1}}];
async function ensureReviewIndexes(db,{apply=false,databaseName}={}){
  if(apply&&(!databaseName||db.databaseName!==databaseName))throw new Error('Confirma la base de datos de destino.');
  const target=db.collection('productreviews');const indexes=await target.listIndexes().toArray().catch(e=>{if(e.code===26)return [];throw e;});const actions=[];
  for(const d of definitions){
    if(indexes.some(i=>JSON.stringify(i.key)===JSON.stringify(d.key)&&!i.unique&&!i.sparse&&!i.partialFilterExpression&&!i.hidden&&(!i.collation||i.collation.locale==='simple'))){actions.push({name:d.name,status:'existing'});continue;}
    if(indexes.some(i=>i.name===d.name))throw new Error('Índice incompatible; revisar manualmente.');
    if(apply)await target.createIndex(d.key,{name:d.name});actions.push({name:d.name,status:apply?'created':'would-create'});
  }return actions;
}
if(require.main===module){require('dotenv').config({quiet:true});const mongoose=require('mongoose');(async()=>{try{if(!process.env.MONGO_URI)throw new Error('Configura MONGO_URI.');await mongoose.connect(process.env.MONGO_URI,{autoIndex:false,serverSelectionTimeoutMS:10000});console.log(JSON.stringify(await ensureReviewIndexes(mongoose.connection.db,{apply:process.argv.includes('--apply'),databaseName:process.argv.find(a=>a.startsWith('--database='))?.slice('--database='.length)}),null,2));}finally{await mongoose.disconnect();}})().catch(e=>{console.error('No se pudieron revisar los índices de reseñas.',e.code||e.name);process.exitCode=1;});}
module.exports={ensureReviewIndexes};
