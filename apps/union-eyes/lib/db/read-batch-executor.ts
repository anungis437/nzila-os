import type {SqlExecutor} from '@/lib/authority/store/executor'

type Row=Record<string,unknown>
type Pending={text:string;params:unknown[];resolve:(value:{rows:Row[]})=>void;reject:(error:unknown)=>void}

/** Request-local transport for canonical read-only fact loaders. It shares no policy or result across requests.
 * Original SQL and bound parameters are retained; varying reads share one round trip through UNION ALL.
 * JSON rows are intentional: canonical fact loaders already parse database timestamps and arrays.
 */
export function createReadBatchExecutor(database:SqlExecutor,maxQueries=64) {
  if(!Number.isSafeInteger(maxQueries) || maxQueries<1 || maxQueries>64)throw new Error('Invalid canonical fact batch size')
  const pending=new Map<string,Pending[]>(),inflight=new Map<string,Promise<{rows:Row[]}>>()
  let scheduled=false,failure:unknown
  const flush=async()=>{
    scheduled=false
    const groups=[...pending.values()];pending.clear()
    await Promise.all(groups.flatMap(group=>Array.from({length:Math.ceil(group.length/maxQueries)},(_,index)=>{
      const chunk=group.slice(index*maxQueries,(index+1)*maxQueries)
      return (async()=>{
        try{
          if(chunk.length===1){chunk[0].resolve(await database.query(chunk[0].text,chunk[0].params));return}
          const parameters:unknown[]=[],parts=chunk.map((entry,index)=>{
            const offset=parameters.length;parameters.push(...entry.params)
            const original=entry.text.replace(/\$(\d+)/g,(_match,ordinal:string)=>'$'+(Number(ordinal)+offset))
            return `SELECT ${index}::int AS "batchSlot",to_jsonb(case_fact) AS "batchRow" FROM (${original}) AS case_fact`
          })
          const result=await database.query<{batchSlot:number;batchRow:Row}>(parts.join('\nUNION ALL\n'),parameters)
          const slots=chunk.map(()=>[] as Row[])
          for(const row of result.rows){
            if(!Number.isInteger(row.batchSlot) || row.batchSlot<0 || row.batchSlot>=chunk.length || !row.batchRow || typeof row.batchRow!=='object')
              throw new Error('Invalid canonical fact batch result')
            slots[row.batchSlot].push(row.batchRow)
          }
          chunk.forEach((entry,index)=>entry.resolve({rows:slots[index]}))
        }catch(error){failure??=error;chunk.forEach(entry=>entry.reject(error))}
      })()
    })))
  }
  const executor:SqlExecutor={
    query<T=Row>(text:string,params:unknown[]=[]) {
      if(!/^\s*SELECT\b/i.test(text) || /;\s*\S/.test(text)){
        const error=new Error('Canonical read batch accepts SELECT fact queries only');failure??=error;return Promise.reject(error)
      }
      // Evaluators may read the database clock after awaited facts or locks. Such a read
      // must reach PostgreSQL at that point, even if the same request read it earlier.
      if(/\/\* ue\.authority\.read-lock(?:-check)? \*\/|\b(?:clock_timestamp|statement_timestamp|transaction_timestamp|now)\s*\(|\bcurrent_timestamp\b/i.test(text))
        return database.query<T>(text,params).catch(error=>{failure??=error;throw error})
      const key=JSON.stringify([text,params])
      let shared=inflight.get(key)
      if(!shared){
        shared=new Promise<{rows:Row[]}>((resolve,reject)=>{
          const group=pending.get(text)??[];group.push({text:text.replace(/;\s*$/,''),params:[...params],resolve,reject});pending.set(text,group)
          if(!scheduled){scheduled=true;queueMicrotask(()=>{void flush()})}
        });inflight.set(key,shared)
      }
      return shared as Promise<{rows:T[]}>
    },
  }
  return {executor,assertHealthy(){if(failure)throw new Error('Canonical authority facts are unavailable',{cause:failure})}}
}
