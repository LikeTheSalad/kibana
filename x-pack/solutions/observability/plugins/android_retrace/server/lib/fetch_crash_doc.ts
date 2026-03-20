/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';

/**
 * Fetches a crash document by its _id and returns the exception.stacktrace field.
 * Returns null if the document doesn't exist or has no stacktrace.
 */
export async function fetchCrashDocument(
  esClient: ElasticsearchClient,
  docId: string,
  index: string
): Promise<string | null> {
  const result = await esClient.search({
    index,
    query: {
      ids: { values: [docId] },
    },
    _source: ['exception.stacktrace'],
    size: 1,
  });

  if (result.hits.hits.length === 0) {
    return null;
  }

  const source = result.hits.hits[0]._source as Record<string, unknown> | undefined;
  if (!source) return null;

  const exception = source.exception as Record<string, unknown> | undefined;
  if (!exception) return null;

  const stacktrace = exception.stacktrace;
  return typeof stacktrace === 'string' ? stacktrace : null;
}
