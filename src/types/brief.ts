import { z } from 'zod';

export const TargetAudienceSchema = z.enum(['student', 'parent', 'both']);
export type TargetAudience = z.infer<typeof TargetAudienceSchema>;

export const CampaignGoalSchema = z.enum(['awareness', 'conversion', 'engagement']);
export type CampaignGoal = z.infer<typeof CampaignGoalSchema>;

export const BriefSchema = z.object({
  id: z.string(),
  targetAudience: TargetAudienceSchema,
  campaignGoal: CampaignGoalSchema,
  emotionalAngle: z.string(),
  offer: z.string().min(1),
  constraints: z.array(z.string()).optional(),
});

export type Brief = z.infer<typeof BriefSchema>;
