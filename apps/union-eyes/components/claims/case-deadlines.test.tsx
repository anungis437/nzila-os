// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/messages/en-CA.json'
import fr from '@/messages/fr-CA.json'
import { CaseDeadlines } from './case-deadlines'

const id='55555555-5555-4555-8555-555555555555'
const row={id,title:'Submit evidence',dueAt:'2027-03-15T03:59:00.000Z',dueDay:'2027-03-14',status:'pending',version:'2027-01-01 00:00:00.123456+00'}
const initial={deadlines:[row],canManage:true,timeZone:'America/Toronto',remindersAvailable:false,truncated:false}
const response=(value:unknown,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value})
function show(locale='en-CA') { return render(<NextIntlClientProvider locale={locale} messages={locale==='fr-CA'?fr:en}><CaseDeadlines caseId="owned-case" /></NextIntlClientProvider>) }
afterEach(()=>{cleanup();vi.unstubAllGlobals()})

describe('case deadline panel',()=>{
  it('shows persisted dates and the actual reminder limit without offering member writes',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>response({...initial,canManage:false})));show()
    expect(await screen.findByText('Submit evidence')).toBeVisible()
    expect(screen.getByText(en.caseDeadlines.trackedDates)).toBeVisible()
    expect(screen.queryByRole('button',{name:'Add deadline'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Mark complete'})).not.toBeInTheDocument()
  })
  it('submits a staff-entered date to the governed case route and refreshes actual persisted rows',async()=>{
    const calls:Array<{url:string;body:Record<string,unknown>}>=[]
    let written=false
    vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{
      if(options?.method==='POST'){calls.push({url,body:JSON.parse(String(options.body))});written=true;return response({},201)}
      return response({...initial,deadlines:written?[row,{...row,id:'new',title:'Response deadline',dueDay:'2027-04-02'}]:[row]})
    }));show()
    await screen.findByText('Submit evidence')
    await userEvent.type(screen.getByLabelText('Deadline name'),'Response deadline')
    fireEvent.change(screen.getByLabelText('Due date'),{target:{value:'2027-04-02'}})
    await userEvent.click(screen.getByRole('button',{name:'Add deadline'}))
    expect(await screen.findByText('Response deadline')).toBeVisible()
    expect(calls).toHaveLength(1);expect(calls[0].url).toBe('/api/cases/owned-case/deadlines')
    expect(calls[0].body).toMatchObject({title:'Response deadline',dueDay:'2027-04-02'})
    expect(calls[0].body.id).toMatch(/^[a-f0-9-]{36}$/)
  })
  it.each([['Mark complete','complete','completed'],['Cancel deadline','cancel','cancelled']])('persists %s with the server version and retains the terminal record',async(label,action,status)=>{
    let body:Record<string,unknown>|undefined
    vi.stubGlobal('fetch',vi.fn(async(_url:string,options?:RequestInit)=>{
      if(options?.method==='PATCH'){body=JSON.parse(String(options.body));return response({})}
      return response({...initial,deadlines:[{...row,status:body?status:'pending'}]})
    }));show();await screen.findByText('Submit evidence');await userEvent.click(screen.getByRole('button',{name:label}))
    await waitFor(()=>expect(screen.queryByRole('button',{name:'Mark complete'})).not.toBeInTheDocument())
    expect(screen.getByText('Submit evidence')).toBeVisible();expect(body).toEqual({id,version:row.version,action})
  })
  it('reloads a conflict and does not claim that the requested new date was saved',async()=>{
    let writes=0;let body:Record<string,unknown>|undefined
    vi.stubGlobal('fetch',vi.fn(async(_url:string,options?:RequestInit)=>{
      if(options?.method==='PATCH'){writes++;body=JSON.parse(String(options.body));return response({error:'CONFLICT'},409)}
      return response({...initial,deadlines:[{...row,dueDay:writes?'2027-05-01':row.dueDay}]})
    }));show();await screen.findByText('Submit evidence');await userEvent.click(screen.getByRole('button',{name:'Change due date'}))
    fireEvent.change(screen.getByLabelText('New due date'),{target:{value:'2027-04-15'}})
    await userEvent.click(screen.getByRole('button',{name:'Save due date'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(en.caseDeadlines.conflict)
    expect(screen.getByText('2027-05-01')).toBeVisible();expect(screen.queryByText('2027-04-15')).not.toBeInTheDocument()
    expect(body).toEqual({id,version:row.version,action:'reschedule',dueDay:'2027-04-15'})
    expect(screen.queryByText(en.caseDeadlines.saved)).not.toBeInTheDocument()
  })
  it('shows a load failure without fabricating an empty deadline list',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>response({},500)));show()
    expect(await screen.findByRole('alert')).toHaveTextContent(en.caseDeadlines.loadFailed)
    expect(screen.queryByText(en.caseDeadlines.empty)).not.toBeInTheDocument()
  })
  it('distinguishes a committed write followed by a failed refresh and hides stale records',async()=>{
    let written=false
    vi.stubGlobal('fetch',vi.fn(async(_url:string,options?:RequestInit)=>{
      if(options?.method==='PATCH'){written=true;return response({})}
      return written?response({},500):response(initial)
    }));show();await screen.findByText('Submit evidence');await userEvent.click(screen.getByRole('button',{name:'Mark complete'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(en.caseDeadlines.savedRefreshFailed)
    expect(screen.queryByText('Submit evidence')).not.toBeInTheDocument()
  })
  it('removes cached case content when the server refuses a write after access changes',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(_url:string,options?:RequestInit)=>response(options?.method?{}:initial,options?.method?403:200)))
    show();await screen.findByText('Submit evidence');await userEvent.click(screen.getByRole('button',{name:'Cancel deadline'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(en.caseDeadlines.accessChanged)
    expect(screen.queryByText('Submit evidence')).not.toBeInTheDocument()
  })
  it('does not let a late write response replace the next case panel',async()=>{
    let release:((value:unknown)=>void)|undefined
    vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{
      if(options?.method==='PATCH')return new Promise(resolve=>{release=resolve})
      return response({...initial,deadlines:[{...row,title:url.includes('next-case')?'Next case date':'Submit evidence'}]})
    }))
    const view=show();await screen.findByText('Submit evidence');await userEvent.click(screen.getByRole('button',{name:'Mark complete'}))
    view.rerender(<NextIntlClientProvider locale="en-CA" messages={en}><CaseDeadlines caseId="next-case" /></NextIntlClientProvider>)
    await screen.findByText('Next case date')
    await act(async()=>{release?.(response({}))})
    expect(screen.getByText('Next case date')).toBeVisible();expect(screen.queryByText('Submit evidence')).not.toBeInTheDocument()
    expect(screen.queryByText(en.caseDeadlines.saved)).not.toBeInTheDocument()
  })
  it('renders the same management controls and date limits in French',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>response(initial)));show('fr-CA')
    expect(await screen.findByRole('button',{name:'Ajouter une échéance'})).toBeVisible()
    expect(screen.getByRole('button',{name:'Marquer comme terminée'})).toBeVisible()
    expect(screen.getByText(fr.caseDeadlines.manualDates)).toBeVisible()
  })
})
