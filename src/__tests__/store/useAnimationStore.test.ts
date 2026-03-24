import { describe, it, expect, beforeEach } from 'vitest'
import { useAnimationStore } from '../../store/useAnimationStore'
import type { AnimationBundle, AnimationClip } from '../../animation/types'

function makeClip(id: string, elementId = 'el-1'): AnimationClip {
  return { id, elementId, duration: 300, easing: 'ease', tracks: [] }
}

function makeBundle(id: string, clips: AnimationClip[] = []): AnimationBundle {
  return { id, name: `Bundle ${id}`, clips }
}

beforeEach(() => {
  useAnimationStore.getState().reset()
})

// ── AnimationBundle CRUD ──────────────────────────────────────────────────────

describe('addAnimationBundle', () => {
  it('번들 추가됨', () => {
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1'))
    expect(useAnimationStore.getState().animationBundles).toHaveLength(1)
  })

  it('여러 번들 추가', () => {
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1'))
    useAnimationStore.getState().addAnimationBundle(makeBundle('b2'))
    expect(useAnimationStore.getState().animationBundles).toHaveLength(2)
  })
})

describe('updateAnimationBundle', () => {
  it('name 업데이트', () => {
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1'))
    useAnimationStore.getState().updateAnimationBundle('b1', { name: 'Renamed' })
    expect(useAnimationStore.getState().animationBundles[0].name).toBe('Renamed')
  })

  it('존재하지 않는 id는 무시', () => {
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1'))
    useAnimationStore.getState().updateAnimationBundle('999', { name: 'Ghost' })
    expect(useAnimationStore.getState().animationBundles[0].name).toBe('Bundle b1')
  })
})

describe('removeAnimationBundle', () => {
  it('번들 제거됨', () => {
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1'))
    useAnimationStore.getState().addAnimationBundle(makeBundle('b2'))
    useAnimationStore.getState().removeAnimationBundle('b1')
    const bundles = useAnimationStore.getState().animationBundles
    expect(bundles).toHaveLength(1)
    expect(bundles[0].id).toBe('b2')
  })
})

// ── Bundle 내 Clip 관리 ────────────────────────────────────────────────────────

describe('addClipToBundle', () => {
  it('번들에 clip 추가됨', () => {
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1'))
    useAnimationStore.getState().addClipToBundle('b1', makeClip('c1'))
    const bundle = useAnimationStore.getState().animationBundles[0]
    expect(bundle.clips).toHaveLength(1)
    expect(bundle.clips[0].id).toBe('c1')
  })

  it('다른 번들에는 영향 없음', () => {
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1'))
    useAnimationStore.getState().addAnimationBundle(makeBundle('b2'))
    useAnimationStore.getState().addClipToBundle('b1', makeClip('c1'))
    const b2 = useAnimationStore.getState().animationBundles.find((b) => b.id === 'b2')!
    expect(b2.clips).toHaveLength(0)
  })
})

describe('updateClipInBundle', () => {
  it('clip duration 업데이트', () => {
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1', [makeClip('c1')]))
    useAnimationStore.getState().updateClipInBundle('b1', 'c1', { duration: 600 })
    const clip = useAnimationStore.getState().animationBundles[0].clips[0]
    expect(clip.duration).toBe(600)
  })

  it('easing 업데이트', () => {
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1', [makeClip('c1')]))
    useAnimationStore.getState().updateClipInBundle('b1', 'c1', { easing: 'linear' })
    const clip = useAnimationStore.getState().animationBundles[0].clips[0]
    expect(clip.easing).toBe('linear')
  })
})

describe('removeClipFromBundle', () => {
  it('번들에서 clip 제거', () => {
    const clips = [makeClip('c1'), makeClip('c2')]
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1', clips))
    useAnimationStore.getState().removeClipFromBundle('b1', 'c1')
    const bundle = useAnimationStore.getState().animationBundles[0]
    expect(bundle.clips).toHaveLength(1)
    expect(bundle.clips[0].id).toBe('c2')
  })
})

// ── cleanupForElement ─────────────────────────────────────────────────────────

describe('cleanupForElement', () => {
  it('삭제된 element 참조 clip 제거', () => {
    const clips = [makeClip('c1', 'el-target'), makeClip('c2', 'el-other')]
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1', clips))
    useAnimationStore.getState().cleanupForElement('el-target')
    const bundle = useAnimationStore.getState().animationBundles[0]
    expect(bundle.clips).toHaveLength(1)
    expect(bundle.clips[0].elementId).toBe('el-other')
  })

  it('여러 번들에서 모두 정리', () => {
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1', [makeClip('c1', 'el-gone')]))
    useAnimationStore.getState().addAnimationBundle(makeBundle('b2', [makeClip('c2', 'el-gone')]))
    useAnimationStore.getState().cleanupForElement('el-gone')
    const bundles = useAnimationStore.getState().animationBundles
    expect(bundles[0].clips).toHaveLength(0)
    expect(bundles[1].clips).toHaveLength(0)
  })

  it('다른 element clip은 유지', () => {
    const clips = [makeClip('c1', 'el-gone'), makeClip('c2', 'el-keep')]
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1', clips))
    useAnimationStore.getState().cleanupForElement('el-gone')
    expect(useAnimationStore.getState().animationBundles[0].clips[0].elementId).toBe('el-keep')
  })
})

// ── loadAnimation ─────────────────────────────────────────────────────────────

describe('loadAnimation', () => {
  it('bundles 로드', () => {
    const bundles = [makeBundle('b1'), makeBundle('b2')]
    useAnimationStore.getState().loadAnimation(undefined, bundles)
    expect(useAnimationStore.getState().animationBundles).toHaveLength(2)
  })

  it('undefined 전달 시 빈 배열로 초기화', () => {
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1'))
    useAnimationStore.getState().loadAnimation(undefined, undefined)
    expect(useAnimationStore.getState().animationBundles).toHaveLength(0)
  })
})

// ── reset ─────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('모든 상태 초기화', () => {
    useAnimationStore.getState().addAnimationBundle(makeBundle('b1'))
    useAnimationStore.getState().reset()
    expect(useAnimationStore.getState().animationBundles).toHaveLength(0)
    expect(useAnimationStore.getState().animationClips).toHaveLength(0)
  })
})
