/**
 * Shared runtime type constants and JSDoc shapes for the Generation Intelligence
 * Foundation. This file is intentionally simple JS; consumer code may rely on the
 * exported enums and TypeScript declaration file generated separately if needed.
 */

/** Known artifact categories in a generation/experiment pipeline. */
export const ArtifactType = {
  SOURCE_CRAWL: 'SOURCE_CRAWL',
  SOURCE_DOCUMENTS: 'SOURCE_DOCUMENTS',
  SOURCE_CONTENT_GRAPH: 'SOURCE_CONTENT_GRAPH',

  SITE_INTELLIGENCE: 'SITE_INTELLIGENCE',
  MEDIA_INTELLIGENCE: 'MEDIA_INTELLIGENCE',
  COMPETITOR_INTELLIGENCE: 'COMPETITOR_INTELLIGENCE',
  SITE_BRIEF: 'SITE_BRIEF',
  SKILL_REGISTRY: 'SKILL_REGISTRY',

  SITE_CONTENT_PLAN: 'SITE_CONTENT_PLAN',
  DESIGN_DIRECTION: 'DESIGN_DIRECTION',
  DESIGN_RECIPE: 'DESIGN_RECIPE',

  GENERATED_CONTENT: 'GENERATED_CONTENT',
  GENERATED_SOURCE: 'GENERATED_SOURCE',
  BUILD_OUTPUT: 'BUILD_OUTPUT',

  SCREENSHOT_SOURCE_DESKTOP: 'SCREENSHOT_SOURCE_DESKTOP',
  SCREENSHOT_SOURCE_MOBILE: 'SCREENSHOT_SOURCE_MOBILE',
  SCREENSHOT_GENERATED_DESKTOP: 'SCREENSHOT_GENERATED_DESKTOP',
  SCREENSHOT_GENERATED_MOBILE: 'SCREENSHOT_GENERATED_MOBILE',

  LIGHTHOUSE: 'LIGHTHOUSE',
  NAVIGATION_REPORT: 'NAVIGATION_REPORT',
  VISUAL_QA: 'VISUAL_QA',
  SECURITY_REPORT: 'SECURITY_REPORT',
  INTEGRITY_REPORT: 'INTEGRITY_REPORT',

  DESIGN_BRIEF: 'DESIGN_BRIEF',
  DESIGN_DIRECTION: 'DESIGN_DIRECTION',
  DESIGN_RECIPE: 'DESIGN_RECIPE',
  DESIGN_REFERENCE: 'DESIGN_REFERENCE',
  DESIGN_PROTOTYPE: 'DESIGN_PROTOTYPE',
  STITCH_OUTPUT: 'STITCH_OUTPUT',

  EXPERIMENT_REPORT: 'EXPERIMENT_REPORT',
  EVALUATION: 'EVALUATION',
  COST_REPORT: 'COST_REPORT',
};

/** Stage status values. */
export const StageStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
};

/** Overall run status values. */
export const RunStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
  SKIPPED: 'SKIPPED',
};

/** Generation mode controls creativity/strategy, independent from engine. */
export const GenerationMode = {
  SAFE: 'SAFE',
  CREATIVE: 'CREATIVE',
  BESPOKE: 'BESPOKE',
};

/** Technical generation engines/providers. */
export const GenerationProvider = {
  TEMPLATE: 'TEMPLATE',
  BLUEPRINT: 'BLUEPRINT',
  AGENT: 'AGENT',
  DEVIN: 'DEVIN',
  CLAUDE_CODE: 'CLAUDE_CODE',
  CODEX: 'CODEX',
  STITCH: 'STITCH',
  DESIGN_TO_CODE: 'DESIGN_TO_CODE',
};

/** Source/content providers. */
export const SourceProvider = {
  WLA: 'WLA',
  FIRECRAWL: 'FIRECRAWL',
};

/** Intelligence/analysis providers. */
export const IntelligenceProvider = {
  RULE_BASED: 'RULE_BASED',
  GEMINI: 'GEMINI',
  OPENAI: 'OPENAI',
};

/** Research providers. */
export const ResearchProvider = {
  WEB_SEARCH: 'WEB_SEARCH',
  PERPLEXITY: 'PERPLEXITY',
};

/** Visual QA providers. */
export const VisualQAProvider = {
  IMPECCABLE_GUIDED_AGENT: 'IMPECCABLE_GUIDED_AGENT',
  AI: 'AI',
  HUMAN: 'HUMAN',
};

/** Error categories. */
export const ErrorCode = {
  CRAWL_FAILED: 'CRAWL_FAILED',
  PROVIDER_FAILED: 'PROVIDER_FAILED',
  INVALID_STRUCTURED_OUTPUT: 'INVALID_STRUCTURED_OUTPUT',
  BUILD_FAILED: 'BUILD_FAILED',
  SCREENSHOT_FAILED: 'SCREENSHOT_FAILED',
  LIGHTHOUSE_FAILED: 'LIGHTHOUSE_FAILED',
  NAVIGATION_FAILED: 'NAVIGATION_FAILED',
  SECURITY_BLOCKED: 'SECURITY_BLOCKED',
  QA_FAILED: 'QA_FAILED',
  NOT_MEASURED: 'NOT_MEASURED',
};

/** Evaluation metric categories. */
export const EvaluationMetric = {
  businessRelevance: 'businessRelevance',
  strategyClarity: 'strategyClarity',
  contentCorrectness: 'contentCorrectness',
  sourceFidelity: 'sourceFidelity',
  informationArchitecture: 'informationArchitecture',
  navigationIntegrity: 'navigationIntegrity',
  ctaClarity: 'ctaClarity',
  visualQuality: 'visualQuality',
  brandAppropriateness: 'brandAppropriateness',
  typography: 'typography',
  composition: 'composition',
  mediaRelevance: 'mediaRelevance',
  performance: 'performance',
  accessibility: 'accessibility',
  bestPractices: 'bestPractices',
  seo: 'seo',
  buildReliability: 'buildReliability',
  duration: 'duration',
  cost: 'cost',
  manualIntervention: 'manualIntervention',
};

/** Severity levels used across QA/security findings. */
export const Severity = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO',
};

/** A sentinel for unmeasured values. */
export const NOT_MEASURED = 'NOT_MEASURED';

/** Measurement quality levels for confidence/caveat labelling. */
export const MeasurementQuality = {
  NOT_MEASURED: 'NOT_MEASURED',
  DETERMINISTIC: 'DETERMINISTIC',
  HEURISTIC: 'HEURISTIC',
  AI_EVALUATED: 'AI_EVALUATED',
  HUMAN: 'HUMAN',
};
