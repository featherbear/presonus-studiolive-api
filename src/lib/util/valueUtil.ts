import PV_steps from "../constants/temp__PVsteps"

type Bounds = [number, number]
/**
 * Convert a logarithmic volume to its respective linear value [0-100]
 */
export function logVolumeToLinear(db) {
  const curveFunction = (x) => Math.trunc(
    72.5204177782 + 2.4734739920 * x + 0.0265675570 * Math.pow(x, 2) + 0.0000880866 * Math.pow(x, 3)
  )

  const inputBounds: Bounds = [-84, 10]
  const outputBounds: Bounds = [0, 100]

  db = clamp(db, inputBounds)

  if (db === inputBounds[0]) return outputBounds[0]
  if (db === inputBounds[1]) return outputBounds[1]
  const result = clamp(curveFunction(db), outputBounds)

  return result
}

/**
 * Restrict `val` between a `min` and `max`
 */
export function clamp(val: number, [min, max]: Bounds) {
  return Math.max(min, Math.min(max, val))
}

type CancelTransitionFn = () => void

/**
 * Transition a value along an easing sine curve.  
 * _Should_ work from a -> b when a </> b
 * 
 * @param from Initial value
 * @param to Final value
 * @param duration Transition period (ms)
 * @param fn Function to execute(intermediateValue)
 * @param callback Completion callback
 * @returns Cancel function
 */
export function transitionValue(from: number, to: number, duration: number, fn: (value: number) => any, callback?: Function) {
  if (duration <= 0 || from === to) {
    fn(to)
    callback?.()
    return (() => { }) as CancelTransitionFn
  }

  // Interval should be at least 10 ms
  const minInterval = 10

  const curveFunction = (position: number) => {
    // Linear
    // return position

    // https://easings.net/#easeInOutSine
    return -(Math.cos(Math.PI * position) - 1) / 2
  }

  // Interval delay
  const interval = Math.max(duration / 100, minInterval)

  const bounds: Bounds = [0, 1]
  // [0 - 1.0] Progress value to increase by
  const step = clamp(interval / duration, bounds)

  // [0 - 1.0] Current progress
  let progress = 0

  const tick = () => {
    fn(from + (to - from) * curveFunction(progress))

    if (progress === bounds[1]) {
      cancelTransition()
      callback?.()
    } else {
      progress = clamp(progress + step, bounds)
    }
  }

  const timer = setInterval(() => tick(), interval)
  tick()

  const cancelTransition: CancelTransitionFn = () => {
    clearInterval(timer)
  }

  return cancelTransition
}
