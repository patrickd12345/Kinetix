/**
 * Minimal curated support KB ingest + query. Uses kinetix_support_kb only.
 * No run data; no LLM orchestration.
 */

import { EmbeddingService } from './embeddingService.js';
import { supportVectorDB } from './supportVectorDB.js';
import { validateSupportArtifactForIngest } from './supportArtifact.js';

/**
 * Ingest one approved artifact as a single chunk (v1). Replaces prior chunks for the same artifact_id.
 *
 * @param {Record<string, unknown>} raw
 */
export async function ingestSupportArtifact(raw) {
  const validated = validateSupportArtifactForIngest(raw);
  if (!validated.ok) {
    throw new Error(validated.errors.join('; '));
  }
  const a = validated.artifact;

  const document = a.excerpt
    ? `${a.title}\n\n${a.excerpt}\n\n${a.body_markdown}`
    : `${a.title}\n\n${a.body_markdown}`;
  const embedding = await EmbeddingService.embedText(document);
  const versionStr = String(a.version);
  const chunkId = `${a.artifact_id}:v${versionStr}:0`;

  await supportVectorDB.deleteByArtifactId(a.artifact_id);

  /** @type {Record<string, string | number>} */
  const metadata = {
    artifact_id: a.artifact_id,
    title: a.title.slice(0, 500),
    version: versionStr,
    chunk_index: 0,
    topic: a.topic,
    intent: a.intent,
    locale: a.locale,
    product: a.product,
    surface: a.surface,
    review_status: a.review_status,
    source_type: a.source_type,
  };

  await supportVectorDB.addChunk({
    id: chunkId,
    embedding,
    document,
    metadata,
  });

  return { chunkId, artifact_id: a.artifact_id, version: a.version };
}

/**
 * Semantic search over support KB only.
 *
 * @param {string} queryText
 * @param {{ topK?: number, topic?: string }} options
 */
export async function querySupportKnowledge(queryText, options = {}) {
  const { topK = 5, topic } = options;
  if (!queryText || typeof queryText !== 'string' || !queryText.trim()) {
    throw new Error('query is required');
  }

  const embedding = await EmbeddingService.embedText(queryText.trim());

  /** @type {Record<string, string>} */
  const where = {
    review_status: 'approved',
    product: 'kinetix',
  };
  if (topic && typeof topic === 'string') {
    where.topic = topic;
  }

  const raw = await supportVectorDB.query(embedding, { topK, where });

  const results = raw.ids.map((id, i) => ({
    chunkId: id,
    distance: raw.distances[i],
    similarity: raw.distances[i] != null ? 1 / (1 + raw.distances[i]) : null,
    document: raw.documents[i] ?? '',
    metadata: raw.metadatas[i] ?? {},
  }));

  return {
    collection: 'kinetix_support_kb',
    query: queryText.trim(),
    topK,
    filters: { topic: topic ?? null },
    results,
  };
}
