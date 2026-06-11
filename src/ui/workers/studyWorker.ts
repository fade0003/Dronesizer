/**
 * Study Web Worker — SPEC §8: runs DOE cases off the main thread, streaming
 * one message per case. Pure compute; all repository writes happen on the
 * main thread when messages arrive.
 */
import type { Component, Configuration } from '../../db/schema';
import type { MissionSegment } from '../../models/sizing';
import { runStudyCase } from '../../solver/studyRunner';

export interface StudyRequest {
  type: 'run';
  config: Configuration;
  components: Component[];
  baseMission: MissionSegment[];
  vectors: Record<string, number>[];
}

export type StudyResponse =
  | { type: 'case'; payload: Awaited<ReturnType<typeof runStudyCase>> }
  | { type: 'done'; total: number; elapsedMs: number };

self.onmessage = (event: MessageEvent<StudyRequest>) => {
  const { config, components, baseMission, vectors } = event.data;
  const started = performance.now();
  void (async () => {
    for (let i = 0; i < vectors.length; i++) {
      const payload = await runStudyCase(
        i,
        config,
        components,
        baseMission,
        vectors[i]!,
      );
      (self as unknown as Worker).postMessage({
        type: 'case',
        payload,
      } satisfies StudyResponse);
    }
    (self as unknown as Worker).postMessage({
      type: 'done',
      total: vectors.length,
      elapsedMs: performance.now() - started,
    } satisfies StudyResponse);
  })();
};
