/**
 * Zonga — Player Context & State Management
 *
 * Client-side state for the global audio player.
 * Manages playback queue, shuffle, repeat, and volume.
 *
 * No server dependencies — pure React context.
 */
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'

// ── Types ───────────────────────────────────────────────────────────────────

export interface PlayerTrack {
  readonly assetId: string
  readonly title: string
  readonly artistName: string
  readonly coverArtUrl: string | null
  readonly durationSeconds: number
  readonly streamUrl: string | null
}

type RepeatMode = 'off' | 'all' | 'one'
type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'

interface PlayerState {
  queue: PlayerTrack[]
  currentIndex: number
  playbackState: PlaybackState
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  error: string | null
}

// ── Actions ─────────────────────────────────────────────────────────────────

type PlayerAction =
  | { type: 'PLAY_TRACK'; track: PlayerTrack }
  | { type: 'PLAY_QUEUE'; queue: PlayerTrack[]; startIndex?: number }
  | { type: 'ADD_TO_QUEUE'; track: PlayerTrack }
  | { type: 'REMOVE_FROM_QUEUE'; index: number }
  | { type: 'SET_PLAYBACK_STATE'; state: PlaybackState }
  | { type: 'SET_CURRENT_INDEX'; index: number }
  | { type: 'SET_CURRENT_TIME'; time: number }
  | { type: 'SET_DURATION'; duration: number }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'TOGGLE_SHUFFLE' }
  | { type: 'CYCLE_REPEAT' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_QUEUE' }

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'PLAY_TRACK':
      return {
        ...state,
        queue: [action.track],
        currentIndex: 0,
        playbackState: action.track.streamUrl ? 'loading' : 'idle',
        currentTime: 0,
        error: null,
      }
    case 'PLAY_QUEUE':
      return {
        ...state,
        queue: action.queue,
        currentIndex: action.startIndex ?? 0,
        playbackState: 'loading',
        currentTime: 0,
        error: null,
      }
    case 'ADD_TO_QUEUE':
      return { ...state, queue: [...state.queue, action.track] }
    case 'REMOVE_FROM_QUEUE': {
      const newQueue = state.queue.filter((_, i) => i !== action.index)
      let newIndex = state.currentIndex
      if (action.index < state.currentIndex) newIndex--
      if (action.index === state.currentIndex) {
        return { ...state, queue: newQueue, currentIndex: Math.min(newIndex, newQueue.length - 1), playbackState: 'idle', currentTime: 0 }
      }
      return { ...state, queue: newQueue, currentIndex: newIndex }
    }
    case 'SET_PLAYBACK_STATE':
      return { ...state, playbackState: action.state, error: null }
    case 'SET_CURRENT_INDEX':
      return { ...state, currentIndex: action.index, currentTime: 0, playbackState: 'loading', error: null }
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.time }
    case 'SET_DURATION':
      return { ...state, duration: action.duration }
    case 'SET_VOLUME':
      return { ...state, volume: Math.max(0, Math.min(1, action.volume)) }
    case 'TOGGLE_MUTE':
      return { ...state, muted: !state.muted }
    case 'TOGGLE_SHUFFLE':
      return { ...state, shuffle: !state.shuffle }
    case 'CYCLE_REPEAT': {
      const modes: RepeatMode[] = ['off', 'all', 'one']
      const next = modes[(modes.indexOf(state.repeat) + 1) % modes.length]
      return { ...state, repeat: next }
    }
    case 'SET_ERROR':
      return { ...state, playbackState: 'error', error: action.error }
    case 'CLEAR_QUEUE':
      return { ...initialState }
    default:
      return state
  }
}

const initialState: PlayerState = {
  queue: [],
  currentIndex: 0,
  playbackState: 'idle',
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeat: 'off',
  error: null,
}

// ── Context ─────────────────────────────────────────────────────────────────

interface PlayerContextValue {
  state: PlayerState
  currentTrack: PlayerTrack | null
  playTrack: (track: PlayerTrack) => void
  playQueue: (queue: PlayerTrack[], startIndex?: number) => void
  addToQueue: (track: PlayerTrack) => void
  removeFromQueue: (index: number) => void
  togglePlayPause: () => void
  skipNext: () => void
  skipPrevious: () => void
  seekTo: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  clearQueue: () => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within <PlayerProvider>')
  return ctx
}

// ── Provider ────────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(playerReducer, initialState)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const shuffleMapRef = useRef<number[]>([])

  const currentTrack = state.queue[state.currentIndex] ?? null

  // Create audio element once
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'auto'
    }
    return () => {
      audioRef.current?.pause()
    }
  }, [])

  // Sync audio source when track changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.streamUrl) return

    audio.src = currentTrack.streamUrl
    audio.load()
    audio.play().catch(() => {
      dispatch({ type: 'SET_ERROR', error: 'Playback failed' })
    })
  }, [currentTrack?.assetId, currentTrack?.streamUrl])

  // Wire up audio events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => dispatch({ type: 'SET_PLAYBACK_STATE', state: 'playing' })
    const onPause = () => dispatch({ type: 'SET_PLAYBACK_STATE', state: 'paused' })
    const onEnded = () => handleTrackEnded()
    const onTimeUpdate = () => dispatch({ type: 'SET_CURRENT_TIME', time: audio.currentTime })
    const onDuration = () => dispatch({ type: 'SET_DURATION', duration: audio.duration })
    const onError = () => dispatch({ type: 'SET_ERROR', error: 'Audio playback error' })
    const onWaiting = () => dispatch({ type: 'SET_PLAYBACK_STATE', state: 'loading' })
    const onCanPlay = () => {
      if (state.playbackState === 'loading') {
        dispatch({ type: 'SET_PLAYBACK_STATE', state: 'playing' })
      }
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('error', onError)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('canplay', onCanPlay)

    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('canplay', onCanPlay)
    }
  })

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.muted ? 0 : state.volume
    }
  }, [state.volume, state.muted])

  // Build shuffle map when queue / shuffle changes
  useEffect(() => {
    if (state.shuffle && state.queue.length > 0) {
      const indices = state.queue.map((_, i) => i).filter((i) => i !== state.currentIndex)
      // Fisher-Yates shuffle
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j]!, indices[i]!]
      }
      shuffleMapRef.current = [state.currentIndex, ...indices]
    }
  }, [state.shuffle, state.queue.length, state.currentIndex])

  const handleTrackEnded = useCallback(() => {
    if (state.repeat === 'one') {
      const audio = audioRef.current
      if (audio) {
        audio.currentTime = 0
        audio.play().catch(() => {})
      }
      return
    }

    const nextIndex = getNextIndex()
    if (nextIndex !== null) {
      dispatch({ type: 'SET_CURRENT_INDEX', index: nextIndex })
    } else {
      dispatch({ type: 'SET_PLAYBACK_STATE', state: 'ended' })
    }
  }, [state.currentIndex, state.queue.length, state.repeat, state.shuffle])

  function getNextIndex(): number | null {
    if (state.queue.length <= 1 && state.repeat !== 'all') return null

    if (state.shuffle) {
      const map = shuffleMapRef.current
      const currentMapIndex = map.indexOf(state.currentIndex)
      if (currentMapIndex < map.length - 1) return map[currentMapIndex + 1]!
      return state.repeat === 'all' ? map[0]! : null
    }

    if (state.currentIndex < state.queue.length - 1) return state.currentIndex + 1
    return state.repeat === 'all' ? 0 : null
  }

  function getPreviousIndex(): number | null {
    if (state.shuffle) {
      const map = shuffleMapRef.current
      const currentMapIndex = map.indexOf(state.currentIndex)
      if (currentMapIndex > 0) return map[currentMapIndex - 1]!
      return state.repeat === 'all' ? map[map.length - 1]! : null
    }

    if (state.currentIndex > 0) return state.currentIndex - 1
    return state.repeat === 'all' ? state.queue.length - 1 : null
  }

  const value = useMemo<PlayerContextValue>(() => ({
    state,
    currentTrack,
    playTrack: (track) => dispatch({ type: 'PLAY_TRACK', track }),
    playQueue: (queue, startIndex) => dispatch({ type: 'PLAY_QUEUE', queue, startIndex }),
    addToQueue: (track) => dispatch({ type: 'ADD_TO_QUEUE', track }),
    removeFromQueue: (index) => dispatch({ type: 'REMOVE_FROM_QUEUE', index }),
    togglePlayPause: () => {
      const audio = audioRef.current
      if (!audio) return
      if (state.playbackState === 'playing') {
        audio.pause()
      } else {
        audio.play().catch(() => dispatch({ type: 'SET_ERROR', error: 'Playback failed' }))
      }
    },
    skipNext: () => {
      const next = getNextIndex()
      if (next !== null) dispatch({ type: 'SET_CURRENT_INDEX', index: next })
    },
    skipPrevious: () => {
      // If past 3 seconds, restart; otherwise go to previous track
      if (audioRef.current && audioRef.current.currentTime > 3) {
        audioRef.current.currentTime = 0
        return
      }
      const prev = getPreviousIndex()
      if (prev !== null) dispatch({ type: 'SET_CURRENT_INDEX', index: prev })
    },
    seekTo: (time) => {
      if (audioRef.current) audioRef.current.currentTime = time
    },
    setVolume: (vol) => dispatch({ type: 'SET_VOLUME', volume: vol }),
    toggleMute: () => dispatch({ type: 'TOGGLE_MUTE' }),
    toggleShuffle: () => dispatch({ type: 'TOGGLE_SHUFFLE' }),
    cycleRepeat: () => dispatch({ type: 'CYCLE_REPEAT' }),
    clearQueue: () => {
      audioRef.current?.pause()
      dispatch({ type: 'CLEAR_QUEUE' })
    },
  }), [state, currentTrack])

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  )
}
