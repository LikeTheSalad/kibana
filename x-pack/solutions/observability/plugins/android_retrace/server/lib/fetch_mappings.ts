/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';
import { MAPPING_INDEX } from '../../common';
import { parseMappingEntry, type MappingEntry } from './parse_mapping_entry';

export interface MappingDocument {
  obfuscatedMethodCall: string;
  entries: MappingEntry[];
  defaultMapping: string | null;
}

/**
 * Fetches R8 mapping documents from the android-r8-mappings index.
 * For the PoC, no build_id filter is applied (single mapping file assumed).
 */
export async function fetchMappings(
  esClient: ElasticsearchClient,
  methodKeys: string[]
): Promise<Map<string, MappingDocument>> {
  if (methodKeys.length === 0) return new Map();

  const result = await esClient.search({
    index: MAPPING_INDEX,
    query: {
      terms: { obfuscated_method_call: methodKeys },
    },
    size: 10000,
  });

  const map = new Map<string, MappingDocument>();

  for (const hit of result.hits.hits) {
    const source = hit._source as Record<string, unknown>;
    const rawMappings = (source.mappings as string[]) ?? [];

    map.set(source.obfuscated_method_call as string, {
      obfuscatedMethodCall: source.obfuscated_method_call as string,
      entries: rawMappings.map(parseMappingEntry),
      defaultMapping: (source.default_mapping as string) ?? null,
    });
  }

  return map;
}
