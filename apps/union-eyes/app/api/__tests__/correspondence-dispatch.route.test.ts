import { beforeEach, describe, expect, it, vi } from 'vitest';
const ID='11111111-1111-4111-8111-111111111111';
const m=vi.hoisted(()=>({withApi:vi.fn(),getCorrespondenceById:vi.fn(),dispatchCorrespondence:vi.fn(),queue:vi.fn(),worker:vi.fn(),after:vi.fn()}));
vi.mock('@/lib/api/with-api',()=>({withApi:m.withApi}));
vi.mock('@/lib/api/errors',()=>({ApiError:{badRequest:(msg:string)=>Object.assign(new Error(msg),{status:400}),notFound:(msg:string)=>Object.assign(new Error(msg),{status:404})}}));
vi.mock('@/lib/services/correspondence-service',()=>({getCorrespondenceById:m.getCorrespondenceById,dispatchCorrespondence:m.dispatchCorrespondence}));
vi.mock('@/lib/correspondence/email-delivery',()=>({queueCorrespondenceEmail:m.queue,processCorrespondenceEmails:m.worker}));
vi.mock('next/server',async original=>({...await original<typeof import('next/server')>(),after:m.after}));
vi.mock('@/lib/logger',()=>({logger:{error:vi.fn()}}));
const context=(body:Record<string,unknown>={dispatchMethod:'email'})=>({params:{id:ID},organizationId:'org_1',userId:'u1',
  user:{name:'Ada',role:'steward'},body,request:new Request(`http://localhost/api/correspondence/${ID}/dispatch`)});
const loadRoute=()=>import('../correspondence/[id]/dispatch/route');
beforeEach(()=>{
  vi.clearAllMocks();m.queue.mockReset();
  m.withApi.mockImplementation((_config:unknown,handler:(ctx:unknown)=>Promise<unknown>)=>handler);
  m.getCorrespondenceById.mockResolvedValue({id:ID,organizationId:'org_1'});
  m.dispatchCorrespondence.mockResolvedValue({id:ID,status:'dispatched'});
  m.queue.mockResolvedValue({state:'queued',correspondenceId:ID,tasks:1});m.worker.mockResolvedValue({attempted:1,accepted:1,unconfirmed:0});
});
describe('correspondence email dispatch boundary',()=>{
  it('answers queued202 after durable enqueue and defers the worker instead of marking the email dispatched',async()=>{
    const {POST}=await loadRoute();const response=await POST(context() as never);
    expect(response.status).toBe(202);expect(await response.json()).toEqual({success:true,data:{state:'queued',correspondenceId:ID,tasks:1}});
    expect(m.queue).toHaveBeenCalledWith(ID,'org_1','u1');expect(m.dispatchCorrespondence).not.toHaveBeenCalled();expect(m.worker).not.toHaveBeenCalled();
    expect(m.after).toHaveBeenCalledTimes(1);await m.after.mock.calls[0][0]();expect(m.worker).toHaveBeenCalledWith();
  });
  it('refuses caller supplied attachment URLs and foreign letters before enqueue or background work',async()=>{
    const {POST}=await loadRoute();
    await expect(POST(context({dispatchMethod:'email',signedPdfUrl:'https://example.invalid/private.pdf'}) as never)).rejects.toMatchObject({status:400});
    m.getCorrespondenceById.mockResolvedValue({id:ID,organizationId:'foreign'});
    await expect(POST(context() as never)).rejects.toMatchObject({status:404});
    expect(m.queue).not.toHaveBeenCalled();expect(m.after).not.toHaveBeenCalled();
  });
  it('does not register a provider task when durable enqueue or its audit fails',async()=>{
    const {POST}=await loadRoute();m.queue.mockRejectedValue(new Error('mandatory audit failed'));
    await expect(POST(context() as never)).rejects.toThrow('mandatory audit failed');expect(m.after).not.toHaveBeenCalled();expect(m.worker).not.toHaveBeenCalled();
  });
  it('records a manually performed postal dispatch through the existing audited lifecycle',async()=>{
    const {POST}=await loadRoute();expect(await POST(context({dispatchMethod:'mail'}) as never)).toEqual({data:{id:ID,status:'dispatched'}});
    expect(m.dispatchCorrespondence).toHaveBeenCalledWith(ID,expect.objectContaining({dispatchMethod:'mail',actorUserId:'u1'}));expect(m.queue).not.toHaveBeenCalled();expect(m.after).not.toHaveBeenCalled();
  });
});
