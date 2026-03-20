/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useState } from 'react';
import {
  EuiPage,
  EuiPageBody,
  EuiPageSection,
  EuiTitle,
  EuiCodeBlock,
  EuiLoadingSpinner,
  EuiCallOut,
  EuiSpacer,
  EuiText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
} from '@elastic/eui';
import type { CoreStart } from '@kbn/core/public';
import { RETRACE_API_PATH } from '../../common';

interface RetraceResponse {
  original: string;
  deobfuscated: string;
}

interface RetraceViewProps {
  core: CoreStart;
}

export function RetraceView({ core }: RetraceViewProps) {
  const [result, setResult] = useState<RetraceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const params = new URLSearchParams(window.location.search);
  const docId = params.get('doc_id');
  const index = params.get('index');

  useEffect(() => {
    if (!docId) {
      setError('No doc_id provided in URL parameters.');
      setLoading(false);
      return;
    }

    const body: Record<string, string> = { doc_id: docId };
    if (index) {
      body.index = index;
    }

    core.http
      .fetch<RetraceResponse>(RETRACE_API_PATH, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      .then((res) => setResult(res))
      .catch((err) => setError(err.body?.message ?? err.message ?? 'Retrace failed'))
      .finally(() => setLoading(false));
  }, [docId, index, core.http]);

  return (
    <EuiPage paddingSize="l">
      <EuiPageBody>
        <EuiPageSection>
          <EuiTitle size="l">
            <h1>Android Crash Deobfuscation</h1>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiText color="subdued" size="s">
            <p>Document: {docId ?? 'none'}</p>
          </EuiText>
          <EuiSpacer size="l" />

          {loading && (
            <EuiFlexGroup justifyContent="center" style={{ height: 200 }}>
              <EuiFlexItem grow={false}>
                <EuiLoadingSpinner size="xl" />
              </EuiFlexItem>
            </EuiFlexGroup>
          )}

          {error && (
            <EuiCallOut title="Deobfuscation failed" color="danger" iconType="alert">
              <p>{error}</p>
            </EuiCallOut>
          )}

          {result && (
            <EuiFlexGroup direction="column" gutterSize="l">
              <EuiFlexItem>
                <EuiPanel hasShadow={false} hasBorder>
                  <EuiTitle size="s">
                    <h2>Deobfuscated Stacktrace</h2>
                  </EuiTitle>
                  <EuiSpacer size="s" />
                  <EuiCodeBlock
                    language="java"
                    isCopyable
                    paddingSize="m"
                    overflowHeight={500}
                    fontSize="s"
                  >
                    {result.deobfuscated}
                  </EuiCodeBlock>
                </EuiPanel>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiPanel hasShadow={false} hasBorder>
                  <EuiTitle size="s">
                    <h2>Original (Obfuscated)</h2>
                  </EuiTitle>
                  <EuiSpacer size="s" />
                  <EuiCodeBlock
                    language="java"
                    isCopyable
                    paddingSize="m"
                    overflowHeight={300}
                    fontSize="s"
                  >
                    {result.original}
                  </EuiCodeBlock>
                </EuiPanel>
              </EuiFlexItem>
            </EuiFlexGroup>
          )}
        </EuiPageSection>
      </EuiPageBody>
    </EuiPage>
  );
}
