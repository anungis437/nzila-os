'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import {readMemberDirectorySetup} from '@/lib/client/member-directory-response'

/** An explicit authenticated POST completes the contact projection. A failed
 * attempt can be retried with the existing session; no invitation is replayed. */
export function MemberDirectoryBootstrap({ enabled, scopeKey, children }: {
  enabled: boolean; scopeKey: string; children: ReactNode
}) {
  const t = useTranslations('memberDirectoryBootstrap')
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{scope:string;status:'ready';memberId:string}|{scope:string;status:'error'}|null>(null)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(),30000)
    let active = true
    const finish=async()=>{
      try {
        const response=await fetch('/api/members/self/bootstrap',{method:'POST',credentials:'same-origin',cache:'no-store',
          headers:{'Content-Type':'application/json'},body:'{}',signal:controller.signal})
        if(!response.ok)throw new Error('Membership setup could not be confirmed')
        const profile=readMemberDirectorySetup(await response.json())
        if(active)setResult({scope:scopeKey,status:'ready',memberId:profile.memberId})
      }catch{if(active)setResult({scope:scopeKey,status:'error'})}
      finally{clearTimeout(deadline)}
    }
    void finish()
    return () => { active = false; clearTimeout(deadline); controller.abort() }
  },[enabled,scopeKey,attempt])
  if (!enabled || result?.scope === scopeKey && result.status === 'ready') return children
  if (result?.scope === scopeKey && result.status === 'error') return <div role="alert" className="space-y-3 p-6">
    <p>{t('failed')}</p><button type="button" className="rounded border px-4 py-2" onClick={() => { setResult(null); setAttempt(n => n + 1) }}>{t('retry')}</button>
  </div>
  return <p role="status" className="p-6">{t('pending')}</p>
}
