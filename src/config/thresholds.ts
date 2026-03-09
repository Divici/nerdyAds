/** Minimum weighted score to accept an ad. */
export const QUALITY_THRESHOLD = 7.0;

/** Maximum improvement cycles before rejecting an ad. */
export const MAX_CYCLES = 3;

/** Buffer below running average for quality ratchet. */
export const RATCHET_BUFFER = 0.5;

/** Minimum possible score per dimension. */
export const MIN_SCORE = 1;

/** Maximum possible score per dimension. */
export const MAX_SCORE = 10;
