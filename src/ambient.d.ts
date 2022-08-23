import type bunyan from 'bunyan'

declare global {
    // eslint-disable-next-line no-var
    var logger: bunyan
}
