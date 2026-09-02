export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type DayKind = 'active' | 'rest';
export type BlockKind = 'sleep' | 'rest' | 'active';

export interface HourBlock {
  startHour: number;
  endHour: number;
  activity: string;
  kind: BlockKind;
}

export interface DayTemplate {
  type: DayKind;
  blocks: HourBlock[];
}

export interface BlogIdentity {
  userNumber: string;
  displayName: string;
  phoneNumber: string | null;
  nameTag: string;
}

export interface BlogProfile {
  userNumber: string;
  displayName: string;
  phoneNumber: string | null;
  nameTag: string;
  sleepTime: string;
  wakeTime: string;
  primaryActivity: string;
  restDays: number[];
  activeDay: DayTemplate;
  restDay: DayTemplate;
  updatedAt: string;
}

export interface BlogComment {
  id: string;
  body: string;
  creatorName: string;
  creatorNumber: string;
  nameTag: string;
  createdAt: string;
}

export interface BlogEntry {
  id: string;
  blogNumber: number;
  junction: string;
  city?: string;
  locality?: string;
  body: string;
  creatorName: string;
  creatorNumber: string;
  nameTag: string;
  tags: string[];
  comments: BlogComment[];
  createdAt: string;
  updatedAt: string;
}

export interface WeekEstimate {
  remainingHours: number;
  activeHours: number;
  restHours: number;
  sleepHours: number;
}

export interface SpanEstimate {
  weekActiveHours: number;
  weekRestHours: number;
  weekSleepHours: number;
  monthActiveHours: number;
  yearActiveHours: number;
}
