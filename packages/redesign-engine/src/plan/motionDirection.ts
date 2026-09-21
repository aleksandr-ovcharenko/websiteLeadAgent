import type { CreativeDirection } from './creativeDirector.js';
import type { ContentTruthGraph } from './contentTruthGraph.js';

export type Easing = [number, number, number, number];

export interface MotionTokenSet {
  easeOut: Easing;
  easeInOut: Easing;
  durationPress: number;
  durationUi: number;
  durationReveal: number;
  staggerCopy: number;
}

export interface KeyframeBeat {
  id: string;
  purpose: string;
  trigger: string;
  duration: number;
  delay: number;
  easing: Easing;
  properties: string[];
  fallback: string;
}

export interface SectionChoreography {
  from: string;
  to: string;
  purpose: string;
  trigger: 'scroll' | 'view' | 'interaction';
  type: 'mask' | 'wipe' | 'spatial-handoff' | 'typographic-shift' | 'decisive-cta';
}

export interface ProjectFrameSpec {
  id: string;
  type: 'sticky-stack' | 'full-bleed-sequence' | 'film-strip';
  spatialRelationship: string;
  titleReveal: string;
  categoryReveal: string;
  mobileEquivalent: string;
}

export interface ServiceInteractionSpec {
  rowTransform: string;
  colorTransition: string;
  hoverImageReveal: string;
  touchEquivalent: string;
  mediaQuery: string;
}

export interface DetailTransitionSpec {
  api: 'ViewTransitions' | 'none';
  fallback: 'instant';
  backNavigation: string;
}

export interface NavigationBehavior {
  headerState: string;
  progress: 'scroll-progress' | 'section-indicator' | 'none';
  mobileMenu: string;
  keyboard: string;
}

export interface MotionDirection {
  version: '1.0';
  motionPersonality: string;
  narrativeBeats: KeyframeBeat[];
  heroTimeline: KeyframeBeat[];
  sectionTransitions: SectionChoreography[];
  projectInteraction: ProjectFrameSpec;
  detailTransition: DetailTransitionSpec;
  navigationBehavior: NavigationBehavior;
  mobileBehavior: string;
  reducedMotionBehavior: string;
  performanceBudget: {
    animatedProperties: string[];
    forbiddenProperties: string[];
    maxBlur: string;
    lazyLoad: boolean;
  };
  prohibitedMotionPatterns: string[];
  tokens: MotionTokenSet;
}

export function buildMotionDirection(direction: CreativeDirection, graph: ContentTruthGraph): MotionDirection {
  const tokens: MotionTokenSet = {
    easeOut: [0.23, 1, 0.32, 1],
    easeInOut: [0.77, 0, 0.175, 1],
    durationPress: 140,
    durationUi: 200,
    durationReveal: 600,
    staggerCopy: 60,
  };

  const opening: KeyframeBeat[] = [
    { id: 'open-media', purpose: 'Hero media settles from scale 1.06 to 1', trigger: 'load', duration: 1200, delay: 0, easing: tokens.easeOut, properties: ['transform: scale(1.06) -> scale(1)'], fallback: 'static hero media at scale 1' },
    { id: 'open-eyebrow', purpose: 'Reveal visual territory label', trigger: 'load', duration: 600, delay: 200, easing: tokens.easeOut, properties: ['opacity 0->1', 'translateY(16px)->0'], fallback: 'static visible' },
    { id: 'open-title', purpose: 'Reveal headline', trigger: 'load', duration: 700, delay: 280, easing: tokens.easeOut, properties: ['opacity 0->1', 'translateY(24px)->0'], fallback: 'static visible' },
    { id: 'open-subtitle', purpose: 'Reveal supporting copy', trigger: 'load', duration: 700, delay: 340, easing: tokens.easeOut, properties: ['opacity 0->1', 'translateY(18px)->0'], fallback: 'static visible' },
    { id: 'open-cta', purpose: 'Reveal primary CTA', trigger: 'load', duration: 600, delay: 420, easing: tokens.easeOut, properties: ['opacity 0->1', 'translateY(14px)->0'], fallback: 'static visible' },
  ];

  const heroScroll: KeyframeBeat[] = [
    { id: 'hero-media-parallax', purpose: 'Hero media scales down and translates as the user scrolls', trigger: 'scroll', duration: 0, delay: 0, easing: tokens.easeOut, properties: ['transform: scale(1) -> scale(0.96)', 'translateY(0) -> translateY(6vh)'], fallback: 'static media' },
    { id: 'hero-content-exit', purpose: 'Hero text exits upward and fades', trigger: 'scroll', duration: 0, delay: 0, easing: tokens.easeInOut, properties: ['opacity 1->0', 'translateY(0) -> translateY(-6vh)'], fallback: 'static visible' },
    { id: 'hero-veil', purpose: 'Dark veil intensifies before projects section appears', trigger: 'scroll', duration: 0, delay: 0, easing: tokens.easeInOut, properties: ['opacity 0 -> 0.55'], fallback: 'static 0.4 opacity' },
  ];

  const sectionTransitions: SectionChoreography[] = [
    { from: 'hero', to: 'projects', purpose: 'Cinematic reveal: the hero dissolves into the first project frame', trigger: 'scroll', type: 'spatial-handoff' },
    { from: 'projects', to: 'services', purpose: 'Shift from visual proof to capability list', trigger: 'view', type: 'typographic-shift' },
    { from: 'services', to: 'about', purpose: 'From indexed list to editorial statement', trigger: 'view', type: 'typographic-shift' },
    { from: 'about', to: 'contact', purpose: 'Decisive conversion moment', trigger: 'view', type: 'decisive-cta' },
  ];

  const projectInteraction: ProjectFrameSpec = {
    id: 'project-sticky-stack',
    type: 'sticky-stack',
    spatialRelationship: 'Each project frame is full-viewport, sticks at top, and is covered by the next frame as the user scrolls.',
    titleReveal: 'Title and category slide in from the bottom-left on first view, using 60ms stagger after the frame settles.',
    categoryReveal: 'Category label appears before the project title by one stagger step.',
    mobileEquivalent: 'Scroll-snap vertical stack; tap a frame to open detail; no sticky stacking at 390px to avoid reduced viewport issues.',
  };

  const serviceInteraction: ServiceInteractionSpec = {
    rowTransform: 'translateX(0) -> translateX(12px) on hover/focus',
    colorTransition: 'border-left-color and opacity, 200ms ease-out',
    hoverImageReveal: 'Show related source image in a fixed contextual pane on desktop hover; tap-to-reveal inline on mobile.',
    touchEquivalent: 'Tap row to toggle inline image; focus-visible shows same border accent.',
    mediaQuery: '@media (hover: hover) and (pointer: fine)',
  };

  const detail: DetailTransitionSpec = { api: 'ViewTransitions', fallback: 'instant', backNavigation: 'Browser back or explicit close button; View Transitions animates the hero image from card to detail hero when supported.' };

  const nav: NavigationBehavior = {
    headerState: 'Header is transparent over the hero, then gains a dark glass background after hero exits.',
    progress: 'section-indicator',
    mobileMenu: 'Accessible slide-down menu with the same anchors; close on selection or Escape.',
    keyboard: 'Focus rings are visible; skip-to-content link; navigation stays interruptible.',
  };

  return {
    version: '1.0',
    motionPersonality: 'Cinematic, deliberate, and physical. Motion is used to build narrative tension and reveal evidence, never to decorate.',
    narrativeBeats: [...opening, ...heroScroll],
    heroTimeline: opening,
    sectionTransitions,
    projectInteraction,
    detailTransition: detail,
    navigationBehavior: nav,
    mobileBehavior: 'Reduced stacking, larger tap targets, scroll-snap project sequence, no hover-dependent image pane.',
    reducedMotionBehavior: 'Disable parallax, pinned transformations, large positional movement, and scroll-linked scales. Retain short opacity and color feedback. Render all content immediately readable.',
    performanceBudget: {
      animatedProperties: ['transform', 'opacity', 'clip-path'],
      forbiddenProperties: ['width', 'height', 'margin', 'padding', 'top', 'left'],
      maxBlur: '20px',
      lazyLoad: true,
    },
    prohibitedMotionPatterns: ['particles', 'cursor blobs', 'floating decorative objects', 'elastic bounce', 'looping decorative motion', 'random parallax on every image', 'generic smooth-scroll hijack'],
    tokens,
  };
}
