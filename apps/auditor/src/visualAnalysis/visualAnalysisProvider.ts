import type { VisualAnalysisInput, VisualAnalysisResult } from './visualAnalysisSchema.js';

export interface VisualAnalysisProvider {
  analyze(input: VisualAnalysisInput): Promise<{ result: VisualAnalysisResult; model: string; usage: unknown | null }>;
}
