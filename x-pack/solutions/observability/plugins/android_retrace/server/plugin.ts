/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { CoreSetup, CoreStart, Logger, Plugin, PluginInitializerContext } from '@kbn/core/server';
import { registerRoutes } from './routes';

export class AndroidRetracePlugin implements Plugin {
  private readonly logger: Logger;

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public setup(core: CoreSetup) {
    const router = core.http.createRouter();
    registerRoutes({ router, logger: this.logger });
    this.logger.info('Android Retrace plugin routes registered');
    return {};
  }

  public start(_core: CoreStart) {
    return {};
  }

  public stop() {}
}
