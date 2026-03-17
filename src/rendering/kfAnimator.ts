// Module-level keyframe animator singleton — replaces window.__choanKF.
//
// Exported as a stable reference so any module can access the animator without
// going through the DOM window object. SDFCanvas sets onComplete on mount.

import { createKeyframeAnimator } from '../animation/keyframeEngine'

export const kfAnimator = createKeyframeAnimator()
