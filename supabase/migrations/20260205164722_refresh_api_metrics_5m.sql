-- Populate api_metrics_5m materialized view (created WITH NO DATA).
-- Required before first query; run periodically via cron or refresh-api-metrics.mjs.

REFRESH MATERIALIZED VIEW api_metrics_5m;
