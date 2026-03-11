/** Minimum weighted score to accept an ad. */
export const QUALITY_THRESHOLD = 7.5;

/** Maximum improvement cycles before rejecting an ad. */
export const MAX_CYCLES = 3;

/** Buffer below running average for quality ratchet. */
export const RATCHET_BUFFER = 0.5;

/** Minimum score any single dimension must meet for acceptance. */
export const MIN_DIMENSION_SCORE = 6;

/** Minimum possible score per dimension. */
export const MIN_SCORE = 1;

/** Maximum possible score per dimension. */
export const MAX_SCORE = 10;

/** Target number of accepted ads per brief before moving on. */
export const TARGET_ACCEPTED_PER_BRIEF = 6;

/** Number of ads to generate per batch in continuous mode. */
export const BATCH_SIZE = 3;

/** Maximum generation rounds per brief (safety cap). */
export const MAX_GENERATION_ROUNDS = 10;
