/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import type { RouteRegisterParameters } from '.';
import { CRASH_INDEX_PATTERN, RETRACE_API_PATH } from '../../common';
import { fetchCrashDocument } from '../lib/fetch_crash_doc';
import { fetchMappings } from '../lib/fetch_mappings';
import { retrace, extractMethodKeys } from '../lib/retrace';
import { handleRouteError } from '../lib/handle_route_error';

export function registerRetraceRoute({ router, logger }: RouteRegisterParameters) {
  router.post(
    {
      path: RETRACE_API_PATH,
      security: {
        authz: {
          enabled: false,
          reason: 'PoC plugin — no feature registration yet',
        },
      },
      options: {
        tags: ['Android', 'R8', 'Retrace'],
      },
      validate: {
        body: schema.object({
          doc_id: schema.string({ minLength: 1 }),
          index: schema.string({ defaultValue: CRASH_INDEX_PATTERN }),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const esClient = (await context.core).elasticsearch.client.asCurrentUser;
        const { doc_id: docId, index } = request.body;

        const stacktrace = await fetchCrashDocument(esClient, docId, index);
        if (!stacktrace) {
          return response.notFound({
            body: { message: `No crash document found with _id "${docId}" in "${index}"` },
          });
        }

        const methodKeys = extractMethodKeys(stacktrace);
        const mappings = await fetchMappings(esClient, methodKeys);
        const deobfuscated = retrace(stacktrace, mappings);

        return response.ok({
          body: { original: stacktrace, deobfuscated },
        });
      } catch (error) {
        return handleRouteError({ error, logger, response, message: 'Retrace failed' });
      }
    }
  );
}
