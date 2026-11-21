// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import { MemberDirectoryBootstrap } from './member-directory-bootstrap'
const success=JSON.stringify({success:true,data:{memberId:'11111111-1111-4111-8111-111111111111',created:true}})
const messages={memberDirectoryBootstrap:{pending:'Finishing membership setup',failed:'Membership setup failed',retry:'Retry setup'}}
const view=(enabled=true,scopeKey='org:user')=><NextIntlClientProvider locale="en-CA" messages={messages}>
  <MemberDirectoryBootstrap enabled={enabled} scopeKey={scopeKey}><p>Dashboard content</p></MemberDirectoryBootstrap>
</NextIntlClientProvider>
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
describe('canonical directory setup',()=>{
  it('holds the dashboard until its explicit POST commits, then uses that session without accepting another invitation',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(success))
    vi.stubGlobal('fetch',fetch);render(view())
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument()
    expect(await screen.findByText('Dashboard content')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]).toEqual(['/api/members/self/bootstrap',expect.objectContaining({method:'POST',body:'{}',credentials:'same-origin'})])
  })
  it('keeps a failed write visible and retries the same authenticated operation',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(new Response('{}',{status:503})).mockResolvedValueOnce(new Response(success))
    vi.stubGlobal('fetch',fetch);render(view())
    expect(await screen.findByRole('alert')).toHaveTextContent('Membership setup failed')
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Retry setup'}))
    expect(await screen.findByText('Dashboard content')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('does not reuse a prior organization result or create platform operators as union members',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(new Response(success)).mockResolvedValueOnce(new Response('{}',{status:403}))
    vi.stubGlobal('fetch',fetch);const {rerender}=render(view())
    expect(await screen.findByText('Dashboard content')).toBeInTheDocument()
    rerender(view(true,'other:user'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    rerender(view(false,'other:platform'))
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
