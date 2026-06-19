import type { ModerationVerdict } from '../types';

export type { Category, ModerationEngine, ModerationVerdict } from '../types';

export type Sensitivity = 'low' | 'medium' | 'high';

/**
 * The keystone abstraction (SIFT_BUILD.md §3).
 * Every classification path implements this one interface so the engine is
 * swappable: RulesModerator is the v1 body; native on-device models implement
 * the same shape. Routing stays separate (see route.ts).
 *
 * Hard rule (SIFT_BUILD.md §5): message plaintext must never be sent off-device.
 * If no on-device model is available, the rules engine is the answer — not a
 * cloud call. Ever.
 */
export interface Moderator {
  readonly name: ModerationVerdict['engine'];
  isAvailable(): Promise<boolean>;
  classify(text: string, opts: { sensitivity: Sensitivity }): Promise<ModerationVerdict>;
}
