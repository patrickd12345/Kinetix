/**
 * Express app factory for the Kinetix RAG HTTP API (testable without listening).
 */

import cors from 'cors';
import express from 'express';
import { EmbeddingService } from './services/embeddingService.js';
import { RAGService } from './services/ragService.js';
import { vectorDB } from './services/vectorDB.js';
import { supportVectorDB } from './services/supportVectorDB.js';
import { ingestSupportArtifact, querySupportKnowledge } from './services/supportKBService.js';
import { appendSupportTicketRecord } from './services/supportTicketCreate.js';
import { verifySupportOpsSecret } from './services/supportTicketOpsAuth.js';
import {
  updateSupportTicketStatus,
  validateExternalTicketId,
  validateStatusUpdateBody,
} from './services/supportTicketStatus.js';
import { getCoachContext } from './services/coachContext.js';
import { resolveKinetixRuntimeEnvFromObject } from '../../api/_lib/env/runtime.shared.mjs';

const runtimeConsole = globalThis.console ?? console;

const CHROMA_UNAVAILABLE_MSG =
  'Chroma unavailable. Start a Chroma server (e.g. npx chroma run --path ./chroma_data or docker run -p 8000:8000 chromadb/chroma).';

function isChromaConnectionError(err) {
  if (!err) return false;
  if (err.name === 'ChromaConnectionError') return true;
  if (err.cause?.code === 'ECONNREFUSED') return true;
  if (String(err.message || '').includes('Failed to connect to chromadb')) return true;
  return false;
}

function handleVectorDBError(res, error, logLabel) {
  if (isChromaConnectionError(error)) {
    runtimeConsole.warn(`[RAG] ${logLabel}: Chroma unavailable (connection refused).`);
    return res.status(503).json({ error: CHROMA_UNAVAILABLE_MSG });
  }
  runtimeConsole.error(`[RAG] ${logLabel}:`, error);
  return res.status(500).json({ error: error.message });
}

/**
 * @param {{
 *   getRuntime?: () => ReturnType<typeof resolveKinetixRuntimeEnvFromObject>;
 *   appendSupportTicketRecord?: typeof appendSupportTicketRecord;
 *   updateSupportTicketStatus?: typeof updateSupportTicketStatus;
 * }} [inject]
 */
export function createRagApp(inject = {}) {
  const getRuntime = inject.getRuntime ?? (() => resolveKinetixRuntimeEnvFromObject());
  const appendTicket = inject.appendSupportTicketRecord ?? appendSupportTicketRecord;
  const patchStatus = inject.updateSupportTicketStatus ?? updateSupportTicketStatus;

  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'kinetix-rag' });
  });

  app.get('/available', async (_req, res) => {
    try {
      const embeddingAvailable = await EmbeddingService.isAvailable();
      const vectorDBAvailable = await vectorDB.initialize().then(() => true).catch(() => false);
      const supportKbAvailable = await supportVectorDB.initialize().then(() => true).catch(() => false);

      res.json({
        available: embeddingAvailable && vectorDBAvailable,
        embedding: embeddingAvailable,
        vectorDB: vectorDBAvailable,
        supportKb: supportKbAvailable,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/analyze', async (req, res) => {
    try {
      const { run, targetKPS, targetNPI, options = {} } = req.body;
      const target = targetKPS ?? targetNPI;
      if (!run || target == null) {
        return res.status(400).json({ error: 'run and targetKPS (or targetNPI) required' });
      }
      const result = await RAGService.analyzeRunWithRAG(run, target, options);
      return res.json(result);
    } catch (error) {
      runtimeConsole.error('RAG analyze error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.post('/similar', async (req, res) => {
    try {
      const { run, options = {} } = req.body;
      if (!run) {
        return res.status(400).json({ error: 'run required' });
      }
      const similar = await RAGService.findSimilarRuns(run, options);
      return res.json({ similarRuns: similar });
    } catch (error) {
      runtimeConsole.error('Find similar error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/indexed-ids', async (_req, res) => {
    try {
      const ids = await vectorDB.getAllRunIds();
      res.json({ ids: ids.map((id) => String(id)) });
    } catch (error) {
      return handleVectorDBError(res, error, 'indexed-ids');
    }
  });

  app.post('/index', async (req, res) => {
    try {
      const { run } = req.body;
      if (!run) {
        return res.status(400).json({ error: 'run required' });
      }
      const embedding = await EmbeddingService.embedRun(run);
      await vectorDB.updateRun(run, embedding);
      return res.json({ success: true, runId: run.id });
    } catch (error) {
      return handleVectorDBError(res, error, 'index');
    }
  });

  app.get('/stats', async (_req, res) => {
    try {
      const count = await vectorDB.getCount();
      res.json({ runCount: count });
    } catch (error) {
      handleVectorDBError(res, error, 'stats');
    }
  });

  /** Curated support KB — separate Chroma collection `kinetix_support_kb` (not runs). */
  app.post('/support/kb/ingest', async (req, res) => {
    try {
      const { artifact } = req.body || {};
      if (!artifact || typeof artifact !== 'object') {
        return res.status(400).json({ error: 'artifact object required' });
      }
      const result = await ingestSupportArtifact(artifact);
      return res.json({ success: true, ...result });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('required') || msg.includes('must be')) {
        return res.status(400).json({ error: msg });
      }
      return handleVectorDBError(res, error, 'support/kb/ingest');
    }
  });

  app.post('/support/kb/query', async (req, res) => {
    try {
      const { query: q, topK, topic } = req.body || {};
      const result = await querySupportKnowledge(typeof q === 'string' ? q : '', { topK, topic });
      return res.json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === 'query is required') {
        return res.status(400).json({ error: msg });
      }
      return handleVectorDBError(res, error, 'support/kb/query');
    }
  });

  app.get('/support/kb/stats', async (_req, res) => {
    try {
      const chunkCount = await supportVectorDB.getCount();
      return res.json({ collection: 'kinetix_support_kb', chunkCount });
    } catch (error) {
      return handleVectorDBError(res, error, 'support/kb/stats');
    }
  });

  /** AI-confirmed Help Center ticket (structured payload; persisted for team pickup). */
  app.post('/support/ticket/create', async (req, res) => {
    try {
      const out = await appendTicket(req.body || {});
      if (out && typeof out === 'object' && out.ok === false) {
        return res.status(503).json({ ok: false, error: 'storage_unavailable' });
      }
      return res.status(201).json(out);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ ok: false, error: msg });
    }
  });

  /**
   * Ops-only: update ticket status in Supabase (not for end users).
   * Requires KINETIX_SUPPORT_OPS_SECRET + X-Kinetix-Support-Ops-Secret or Authorization: Bearer.
   */
  app.patch('/support/ticket/:ticketId/status', async (req, res) => {
    try {
      const runtime = getRuntime();
      const auth = verifySupportOpsSecret(req.headers, runtime.kinetixSupportOpsSecret);
      if (!auth.ok) {
        if (auth.code === 'unconfigured') {
          return res.status(503).json({ ok: false, error: 'ops_unconfigured' });
        }
        return res.status(401).json({ ok: false, error: 'unauthorized' });
      }

      const idCheck = validateExternalTicketId(req.params.ticketId);
      if (!idCheck.ok) {
        return res.status(400).json({ ok: false, error: idCheck.error });
      }

      const bodyCheck = validateStatusUpdateBody(req.body);
      if (!bodyCheck.ok) {
        return res.status(400).json({ ok: false, error: bodyCheck.error });
      }

      const { status, metadataPatch } = bodyCheck.value;
      const out = await patchStatus(idCheck.ticketId, status, { metadataPatch });

      if (!out.ok) {
        if (out.kind === 'not_found') {
          return res.status(404).json({ ok: false, error: 'not_found' });
        }
        return res.status(503).json({ ok: false, error: 'storage_unavailable' });
      }

      return res.json({
        ok: true,
        ticketId: out.ticketId,
        status: out.status,
        updatedAt: out.updatedAt,
      });
    } catch (err) {
      runtimeConsole.error('[RAG] support ticket status PATCH:', err);
      return res.status(503).json({ ok: false, error: 'storage_unavailable' });
    }
  });

  app.post('/coach-context', async (req, res) => {
    try {
      const { message = '', userProfile, pbRun, unitSystem: rawUnits } = req.body || {};
      const unitSystem = rawUnits === 'imperial' ? 'imperial' : 'metric';
      const result = await getCoachContext(message, userProfile || null, pbRun || null, unitSystem);
      res.json(result);
    } catch (error) {
      if (isChromaConnectionError(error)) {
        runtimeConsole.warn('[RAG] coach-context: Chroma unavailable (connection refused).');
      } else {
        runtimeConsole.error('[RAG] Coach context error:', error);
      }
      res.status(200).json({
        context:
          'RAG unavailable. Give general advice only. Do not invent NPI or pace from the user\'s runs.',
        contract: {
          verifiedFacts: {
            unitSystem,
            dataAvailability: {
              hasRetrievedRuns: false,
              hasPbTargets: false,
            },
            retrievedRunCount: 0,
            retrievedRuns: [],
            pbPaceToBeat: null,
          },
          userStatedFacts: {},
          allowedOutputModes: [
            'explanation',
            'comparison',
            'coaching_summary',
            'motivation',
            'insufficient_data',
            'verified_math',
          ],
          forbiddenOperations: [
            'invent_numbers',
            'introduce_new_numeric_value',
            'derive_new_numeric_target',
            'modify_verified_values',
            'infer_missing_inputs',
            'medical_diagnosis',
            'unsupported_prediction',
            'future_performance_prediction',
            'physiological_claim',
            'injury_prediction',
            'training_effect_prediction',
            'performance_ranking_claim',
            'trend_claim',
            'improvement_claim',
            'regression_claim',
          ],
          provenance: [
            {
              kind: 'verified_fact',
              source: 'coach-context:fallback',
              path: 'verifiedFacts.dataAvailability',
            },
          ],
        },
      });
    }
  });

  return app;
}
