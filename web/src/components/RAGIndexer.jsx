import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { RAGIndexService } from '../services/ragIndexService';

/**
 * RAG Indexer Component
 * Allows users to index their runs into the vector database
 */
export function RAGIndexer({ onClose }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexed, setIndexed] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    checkAvailability();
    loadStats();
  }, []);

  const checkAvailability = async () => {
    const available = await RAGIndexService.isAvailable();
    setIsAvailable(available);
  };

  const loadStats = async () => {
    const statsData = await RAGIndexService.getStats();
    setStats(statsData);
  };

  const handleIndexAll = async () => {
    setIsIndexing(true);
    setError(null);
    setIndexed(0);

    try {
      const runs = await StorageService.getAllRuns();
      setTotal(runs.length);

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        try {
          const success = await RAGIndexService.indexRun(run);
          if (success) {
            successCount++;
          } else {
            errorCount++;
          }
          setIndexed(successCount + errorCount);
        } catch (error) {
          console.error(`Error indexing run ${run.id}:`, error);
          errorCount++;
          setIndexed(successCount + errorCount);
        }
      }

      await loadStats();
      setIsIndexing(false);

      if (errorCount > 0) {
        setError(`${successCount} indexed, ${errorCount} errors`);
      }
    } catch (error) {
      console.error('Indexing error:', error);
      setError(error.message);
      setIsIndexing(false);
    }
  };

  if (!isAvailable) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-50">
        <div className="glass border border-orange-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="text-orange-400" size={24} />
            <h3 className="text-lg font-black text-orange-400">RAG Service Not Available</h3>
          </div>
          <p className="text-sm text-gray-300 mb-4">
            The RAG service needs to be running to index runs.
          </p>
          <div className="space-y-2 text-xs text-gray-400 mb-4">
            <p>1. Start RAG service: <code className="bg-gray-900 px-2 py-1 rounded">cd web/rag && npm start</code></p>
            <p>2. Make sure Ollama is running: <code className="bg-gray-900 px-2 py-1 rounded">ollama serve</code></p>
            <p>3. Pull embedding model: <code className="bg-gray-900 px-2 py-1 rounded">ollama pull nomic-embed-text</code></p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-gray-300 font-bold border border-gray-700/50 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-50">
      <div className="glass border border-cyan-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Database className="text-cyan-400" size={24} />
          <h3 className="text-lg font-black text-cyan-400">Index Runs for RAG</h3>
        </div>

        {stats && (
          <div className="mb-4 p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
            <div className="text-sm text-gray-300">
              <span className="font-bold text-cyan-400">{stats.runCount || 0}</span> runs already indexed
            </div>
          </div>
        )}

        <p className="text-sm text-gray-300 mb-4">
          Index your runs to enable AI analysis with historical context. This will use your local Ollama instance to generate embeddings.
        </p>

        {isIndexing && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Indexing...</span>
              <span className="text-sm font-bold text-cyan-400">
                {indexed}/{total}
              </span>
            </div>
            <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
                style={{ width: `${total > 0 ? (indexed / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
            <div className="text-sm text-orange-400">{error}</div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-gray-300 font-bold border border-gray-700/50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleIndexAll}
            disabled={isIndexing}
            className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 rounded-xl text-white font-bold shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isIndexing ? (
              <>
                <Loader className="animate-spin" size={16} />
                Indexing...
              </>
            ) : (
              <>
                <Database size={16} />
                Index All Runs
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


