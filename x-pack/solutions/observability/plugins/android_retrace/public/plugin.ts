/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AppMountParameters, CoreSetup, Plugin } from '@kbn/core/public';
import { PLUGIN_ID } from '../common';

export type AndroidRetracePluginSetup = void;
export type AndroidRetracePluginStart = void;

export class AndroidRetracePlugin
  implements Plugin<AndroidRetracePluginSetup, AndroidRetracePluginStart>
{
  public setup(core: CoreSetup) {
    core.application.register({
      id: PLUGIN_ID,
      title: 'Android Retrace',
      appRoute: `/app/${PLUGIN_ID}`,
      visibleIn: [],
      async mount(params: AppMountParameters) {
        const { renderApp } = await import('./app');
        const [coreStart] = await core.getStartServices();
        return renderApp(coreStart, params);
      },
    });
  }

  public start() {}
}
