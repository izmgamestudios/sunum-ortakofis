// client/src/types.ts
export type Emotion = 'neutral' | 'sad' | 'angry' | 'joyful' | 'excited' | 'scared' | 'surprised' | 'calm' | 'nostalgic';
export type Tone = 'serious' | 'friendly' | 'humorous' | 'formal' | 'inspiring';
export type Setting = 'stage' | 'family' | 'elevator' | 'meeting' | 'cafe' | 'classroom' | 'online' | 'interview' | 'street';
export type TimeOfDay = 'morning' | 'noon' | 'evening' | 'night';

export interface RoleplayConfig {
  enabled: boolean;
  emotion: Emotion;
  tone: Tone;
  setting: Setting;
  timeOfDay: TimeOfDay;
  /** 1 = birebir … 5 = kalabalık salon */
  crowd: 1 | 2 | 3 | 4 | 5;
  /** Her adımda rastgele yeni bir senaryo zarı atılır */
  randomizePerStep: boolean;
}

export type BreakMode = 'none' | 'manual' | 'auto';
export type BreakActivity = 'breathing' | 'stretch' | 'water' | 'silent';

export interface BreakConfig {
  mode: BreakMode;
  autoSeconds: 15 | 30 | 45 | 60;
  activities: BreakActivity[];
  order: 'cycle' | 'random';
}

export type AttachmentKind = 'image' | 'pdf' | 'video' | 'audio' | 'link' | 'file';

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  /** Embedded file content (base64 data URL) — travels inside .snmtdz exports */
  dataUrl?: string;
  /** External URL (links, remote media) */
  url?: string;
}

export type CanvasTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'sticky';

export interface CanvasElement {
  id: string;
  type: 'path' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'polygon' | 'text' | 'image' | 'sticky' | 'media';
  color: string;
  width: number;
  opacity?: number;
  points?: number[]; // flat [x0,y0,x1,y1,…] in logical canvas units
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  fontSize?: number;
  /** text alignment inside its box (multi-line labels) */
  align?: 'left' | 'center';
  attachmentId?: string;
  /** radians, around the element's bounding-box centre */
  rotation?: number;
  /** background for sticky notes, rects, ellipses and polygons */
  fill?: string;
  /** framework infographics: id of the source model */
  frameworkId?: number;
  hidden?: boolean;
  locked?: boolean;
  /** innermost group (layer folder) this element belongs to */
  groupId?: string;
}

/** Layer folder / group. Groups nest through parentId. */
export interface CanvasGroup {
  id: string;
  name: string;
  parentId?: string;
  collapsed?: boolean;
  hidden?: boolean;
  /** the whole group can't move */
  locked?: boolean;
  /** children can't be moved one by one (texts stay editable) — default for framework infographics */
  lockChildren?: boolean;
  frameworkId?: number;
}

export interface TopicNode {
  id: string;
  label: string;
  children: TopicNode[];
  visited?: boolean;
}

export type TopicMode = 'free' | 'tombala' | 'tree';

export interface Step {
  id: string;
  title: string;
  durationSec: number;
  /** plain text (search, speech matching, reports) — mirrors `html` when rich text is used */
  text: string;
  /** rich text (sanitized HTML: bold, size, font, colour, alignment, lists, links) */
  html?: string;
  attachments: Attachment[];
  canvas: CanvasElement[];
  groups: CanvasGroup[];
  topicMode: TopicMode;
  words: string[];
  drawnWords: string[];
  markedWords: string[];
  topicTree: TopicNode[];
  /** reflection shown on the break screen right before this step (🫁 geçiş göndermesi) */
  cue?: string;
  /** interactive tool shown as an extra stage tab */
  widget?: 'pixels';
  /** presenter's canvas zoom / pan — read-only viewers follow it */
  view?: CanvasView;
  /** transition (break) after this step: undefined = follow the global break setting */
  breakAfter?: boolean;
}

/** visible board region: top-left (ox, oy) in board units, zoom 1 = the 16:9 frame */
export interface CanvasView {
  zoom: number;
  ox: number;
  oy: number;
}

export type NoteKind = 'note' | 'quote' | 'action' | 'idea' | 'question';

export interface Note {
  id: string;
  stepIndex: number;
  kind: NoteKind;
  text: string;
  /** ms since presentation start (or epoch if not started) */
  at: number;
  author?: string;
}

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  at: number;
  stepIndex: number;
  fromPresenter?: boolean;
}

export interface StepRun {
  stepIndex: number;
  startedAt: number;
  endedAt?: number;
  plannedSec: number;
  actualSec?: number;
  pausedSec: number;
  roleplay?: string;
  emotion?: Emotion;
}

export interface BreakRun {
  afterStep: number;
  activity: BreakActivity;
  plannedSec: number | null;
  actualSec?: number;
  startedAt: number;
  endedAt?: number;
}

export interface RunLog {
  startedAt?: number;
  endedAt?: number;
  steps: StepRun[];
  breaks: BreakRun[];
  reactions: Record<string, number>;
  audiencePeak: number;
  suggestedWords: string[];
  bingoCount: number;
  /** words / tree nodes auto-marked from speech transcript */
  autoMarked: number;
}

export interface Swot {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface Presentation {
  format: 'snmtdz';
  version: 1;
  id: string;
  title: string;
  presenter: string;
  audience: string;
  createdAt: number;
  updatedAt: number;
  steps: Step[];
  breakConfig: BreakConfig;
  roleplay: RoleplayConfig;
  autoAdvance: boolean;
  notes: Note[];
  chat: ChatMessage[];
  run: RunLog;
  swot: Swot;
  reflection: string;
  transcript: TranscriptSegment[];
  templateId?: string;
  /** opening screen shown before step 1 (timer waits) */
  intro?: IntroConfig;
  /** closing screen: thanks + contact */
  outro?: OutroConfig;
}

export interface IntroConfig {
  enabled: boolean;
  image?: Attachment;
  /** defaults to the presentation title */
  title?: string;
  subtitle?: string;
}

export type ContactKind = 'email' | 'phone' | 'whatsapp' | 'website' | 'linkedin' | 'instagram' | 'x' | 'youtube' | 'github' | 'other';

export interface ContactLink {
  kind: ContactKind;
  value: string;
  label?: string;
}

export interface OutroConfig {
  enabled: boolean;
  image?: Attachment;
  message: string;
  contacts: ContactLink[];
}

export interface TranscriptSegment {
  id: string;
  stepIndex: number;
  /** ms since presentation start */
  at: number;
  text: string;
  source: 'speech' | 'manual';
  /** tombala words / topic nodes matched in this segment */
  matches: string[];
}

export type Phase = 'idle' | 'step' | 'break' | 'done';

export interface LiveState {
  phase: Phase;
  stepIndex: number;
  phaseStartedAt: number;
  pausedAt: number | null;
  pausedTotalMs: number;
  breakActivity: BreakActivity | null;
  breakPlannedSec: number | null;
  breakExtraSec: number;
  currentRoleplay: RoleplayConfig | null;
  flipKey: number;
  /** intro screen is showing (step 1 waits, paused) */
  intro?: boolean;
}

export type View = 'library' | 'setup' | 'live' | 'report' | 'templates' | 'faq' | 'credits' | 'pixels';
