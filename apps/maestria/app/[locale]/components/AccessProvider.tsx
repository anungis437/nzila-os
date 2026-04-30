"use client"

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { resolveActor, withActorParam, type ActorContext } from '@/lib/access-control'

export type PersonaMode = 'mission-control' | 'concierge'

type AccessContextValue = {
  actor: ActorContext
  actorKey: string
  withActor: (path: string) => string
  personaMode: PersonaMode
  setPersonaMode: (mode: PersonaMode) => void
}

const AccessContext = createContext<AccessContextValue | null>(null)

const ACTOR_PREFERENCE_KEY = 'maestria.actor-preference'
const PERSONA_MODE_KEY = 'maestria.persona-mode'

export function AccessProvider({ children, defaultActorKey = 'lissa' }: { children: React.ReactNode; defaultActorKey?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const actorParam = searchParams.get('as')
  const actorKey = actorParam ?? defaultActorKey
  const [personaMode, setPersonaModeState] = useState<PersonaMode>('mission-control')

  useEffect(() => {
    const savedMode = window.localStorage.getItem(PERSONA_MODE_KEY)
    if (savedMode === 'mission-control' || savedMode === 'concierge') {
      setPersonaModeState(savedMode)
    }
  }, [])

  useEffect(() => {
    if (actorParam) {
      window.localStorage.setItem(ACTOR_PREFERENCE_KEY, actorParam)
      return
    }

    const savedActor = window.localStorage.getItem(ACTOR_PREFERENCE_KEY)
    if (!savedActor || savedActor === actorKey) {
      return
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('as', savedActor)
    router.replace(`${pathname}?${nextParams.toString()}`)
  }, [actorKey, actorParam, pathname, router, searchParams])

  const value = useMemo<AccessContextValue>(() => {
    const actor = resolveActor({ as: actorKey })
    return {
      actor,
      actorKey,
      withActor: (path: string) => withActorParam(path, actorKey),
      personaMode,
      setPersonaMode: (mode: PersonaMode) => {
        setPersonaModeState(mode)
        window.localStorage.setItem(PERSONA_MODE_KEY, mode)
      },
    }
  }, [actorKey, personaMode])

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

export function useAccessContext() {
  const ctx = useContext(AccessContext)
  if (!ctx) {
    throw new Error('useAccessContext must be used inside AccessProvider')
  }
  return ctx
}
