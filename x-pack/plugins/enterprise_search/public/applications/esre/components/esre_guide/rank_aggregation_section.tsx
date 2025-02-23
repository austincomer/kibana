/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';

import { EuiFlexGroup, EuiFlexItem, EuiText, EuiTitle } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';

import linearCombinationIllustration from '../../../../assets/images/linear.svg';
import rrfRankingIllustration from '../../../../assets/images/rrf.svg';

import { EsreGuideAccordion } from './esre_guide_accordion';

export const RankAggregationSection: React.FC = () => (
  <EuiFlexGroup alignItems="center">
    <EuiFlexItem grow={4}>
      <EuiFlexGroup direction="column" gutterSize="s" justifyContent="flexStart">
        <EuiFlexItem grow={false}>
          <EuiTitle>
            <h2>
              <FormattedMessage
                id="xpack.enterpriseSearch.esre.rankAggregationSection.title"
                defaultMessage="Use a rank aggregation method"
              />
            </h2>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText>
            <p>
              <FormattedMessage
                id="xpack.enterpriseSearch.esre.rankAggregationSection.description"
                defaultMessage="Optional methods for fusing or combining different rankings to achieve better overall ranking performance."
              />
            </p>
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiFlexItem>
    <EuiFlexItem grow={6}>
      <EuiFlexGroup direction="column">
        <EuiFlexItem grow={false}>
          <EsreGuideAccordion
            id="rrfRankingAccordion"
            icon={rrfRankingIllustration}
            title={i18n.translate('xpack.enterpriseSearch.esre.rrfRankingAccordion.title', {
              defaultMessage: 'RRF hybrid ranking',
            })}
            description={i18n.translate(
              'xpack.enterpriseSearch.esre.rrfRankingAccordion.description',
              {
                defaultMessage: 'Intelligently combines rankings without configuration',
              }
            )}
          >
            <>
              <p>Placeholder</p>
            </>
          </EsreGuideAccordion>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EsreGuideAccordion
            id="linearCombinationAccordion"
            icon={linearCombinationIllustration}
            title={i18n.translate('xpack.enterpriseSearch.esre.linearCombinationAccordion.title', {
              defaultMessage: 'Linear combination',
            })}
            description={i18n.translate(
              'xpack.enterpriseSearch.esre.linearCombinationAccordion.description',
              {
                defaultMessage: 'Weighted results from multiple rankings',
              }
            )}
          >
            <>
              <p>Placeholder</p>
            </>
          </EsreGuideAccordion>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiFlexItem>
  </EuiFlexGroup>
);
