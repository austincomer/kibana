/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { FC, useCallback, useMemo, useState } from 'react';

import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { escapeKuery } from '@kbn/es-query';

import {
  EuiButtonIcon,
  EuiContextMenuItem,
  EuiContextMenuPanel,
  EuiDataGridColumn,
  EuiDataGridProps,
  EuiPopover,
  EuiSpacer,
  EuiText,
  EuiToolTip,
} from '@elastic/eui';

import type { DataView } from '@kbn/data-views-plugin/public';
import { type MlKibanaUrlConfig } from '@kbn/ml-anomaly-utils';
import { ES_CLIENT_TOTAL_HITS_RELATION } from '@kbn/ml-query-utils';
import {
  type DataGridItem,
  DataGrid,
  RowCountRelation,
  UseIndexDataReturnType,
  INDEX_STATUS,
} from '@kbn/ml-data-grid';
import {
  getAnalysisType,
  isClassificationAnalysis,
  isRegressionAnalysis,
  type DataFrameAnalyticsConfig,
} from '@kbn/ml-data-frame-analytics-utils';

import * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { SEARCH_QUERY_LANGUAGE } from '../../../../../../../common/constants/search';

import { getToastNotifications } from '../../../../../util/dependency_cache';
import { useColorRange, ColorRangeLegend } from '../../../../../components/color_range_legend';
import { useMlKibana } from '../../../../../contexts/kibana';

import { defaultSearchQuery, renderCellPopoverFactory, SEARCH_SIZE } from '../../../../common';

import {
  replaceTokensInDFAUrlValue,
  openCustomUrlWindow,
} from '../../../../../util/custom_url_utils';

import { ExpandableSection, ExpandableSectionProps, HEADER_ITEMS_LOADING } from '.';
import { IndexPatternPrompt } from '../index_pattern_prompt';

const showingDocs = i18n.translate(
  'xpack.ml.dataframe.analytics.explorationResults.documentsShownHelpText',
  {
    defaultMessage: 'Showing documents for which predictions exist',
  }
);

const showingFirstDocs = i18n.translate(
  'xpack.ml.dataframe.analytics.explorationResults.firstDocumentsShownHelpText',
  {
    defaultMessage: 'Showing first {searchSize} documents for which predictions exist',
    values: { searchSize: SEARCH_SIZE },
  }
);

const getResultsSectionHeaderItems = (
  columnsWithCharts: EuiDataGridColumn[],
  status: INDEX_STATUS,
  tableItems: Array<Record<string, any>>,
  rowCount: number,
  rowCountRelation: RowCountRelation,
  colorRange?: ReturnType<typeof useColorRange>
): ExpandableSectionProps['headerItems'] => {
  return columnsWithCharts.length > 0 && (tableItems.length > 0 || status === INDEX_STATUS.LOADED)
    ? [
        {
          id: 'explorationTableTotalDocs',
          label: (
            <FormattedMessage
              id="xpack.ml.dataframe.analytics.exploration.explorationTableTotalDocsLabel"
              defaultMessage="Total docs"
            />
          ),
          value: `${rowCountRelation === ES_CLIENT_TOTAL_HITS_RELATION.GTE ? '>' : ''}${rowCount}`,
        },
        ...(colorRange !== undefined
          ? [
              {
                id: 'colorRangeLegend',
                value: (
                  <ColorRangeLegend
                    colorRange={colorRange}
                    title={i18n.translate(
                      'xpack.ml.dataframe.analytics.exploration.colorRangeLegendTitle',
                      {
                        defaultMessage: 'Feature influence score',
                      }
                    )}
                  />
                ),
              },
            ]
          : []),
      ]
    : HEADER_ITEMS_LOADING;
};

interface ExpandableSectionResultsProps {
  colorRange?: ReturnType<typeof useColorRange>;
  indexData: UseIndexDataReturnType;
  indexPattern?: DataView;
  jobConfig?: DataFrameAnalyticsConfig;
  needsDestIndexPattern: boolean;
  resultsField?: string;
  searchQuery: estypes.QueryDslQueryContainer;
}

export const ExpandableSectionResults: FC<ExpandableSectionResultsProps> = ({
  colorRange,
  indexData,
  indexPattern,
  jobConfig,
  needsDestIndexPattern,
  resultsField,
  searchQuery,
}) => {
  const {
    services: {
      application,
      share,
      data,
      http: { basePath },
    },
  } = useMlKibana();

  const dataViewId = indexPattern?.id;

  const discoverLocator = useMemo(
    () => share.url.locators.get('DISCOVER_APP_LOCATOR'),
    [share.url.locators]
  );

  const discoverUrlError = useMemo(() => {
    if (!application.capabilities.discover?.show) {
      const discoverNotEnabled = i18n.translate(
        'xpack.ml.dataframe.analytics.exploration.dataGridActions.discoverNotEnabledErrorMessage',
        {
          defaultMessage: 'Discover is not enabled',
        }
      );

      return discoverNotEnabled;
    }
    if (!discoverLocator) {
      const discoverLocatorMissing = i18n.translate(
        'xpack.ml.dataframe.analytics.exploration.dataGridActions.discoverLocatorMissingErrorMessage',
        {
          defaultMessage: 'No locator for Discover detected',
        }
      );

      return discoverLocatorMissing;
    }
    if (!dataViewId) {
      const autoGeneratedDiscoverLinkError = i18n.translate(
        'xpack.ml.dataframe.analytics.exploration.dataGridActions.autoGeneratedDiscoverLinkErrorMessage',
        {
          defaultMessage: 'Unable to link to Discover; no data view exists for this index',
        }
      );

      return autoGeneratedDiscoverLinkError;
    }
  }, [application.capabilities.discover?.show, dataViewId, discoverLocator]);

  const { columnsWithCharts, status, tableItems } = indexData;

  // Results section header items and content
  const resultsSectionHeaderItems = getResultsSectionHeaderItems(
    columnsWithCharts,
    status,
    tableItems,
    indexData.rowCount,
    indexData.rowCountRelation,
    colorRange
  );
  const analysisType =
    jobConfig && jobConfig.analysis ? getAnalysisType(jobConfig.analysis) : undefined;

  const generateDiscoverUrl = useCallback(
    async (rowIndex: number) => {
      const item = tableItems[rowIndex];

      if (discoverLocator !== undefined) {
        const url = await discoverLocator.getRedirectUrl({
          indexPatternId: dataViewId,
          timeRange: data.query.timefilter.timefilter.getTime(),
          filters: data.query.filterManager.getFilters(),
          query: {
            language: SEARCH_QUERY_LANGUAGE.KUERY,
            // Filter for all visible column values of supported types - except the results field values
            query: indexData.visibleColumns
              .filter(
                (column) =>
                  item[column] !== undefined &&
                  (typeof item[column] === 'string' || typeof item[column] === 'number') &&
                  !column.includes(resultsField!)
              )
              .map((column) => `${escapeKuery(column)}:${escapeKuery(String(item[column]))}`)
              .join(' and '),
          },
        });

        return url;
      }
    },
    [indexData?.visibleColumns, discoverLocator, dataViewId, resultsField, tableItems, data]
  );

  const openCustomUrl = (item: DataGridItem, customUrl: MlKibanaUrlConfig) => {
    // Replace any tokens in the configured url_value with values from the source record and open link in a new tab/window.
    const urlPath = replaceTokensInDFAUrlValue(
      customUrl,
      item,
      data.query.timefilter.timefilter.getTime()
    );
    openCustomUrlWindow(urlPath, customUrl, basePath.get());
  };

  const trailingControlColumns: EuiDataGridProps['trailingControlColumns'] = [
    {
      id: 'actions',
      width: 60,
      headerCellRender: () => (
        <FormattedMessage
          id="xpack.ml.dataframe.analytics.exploration.dataGridActions.columnTitle"
          defaultMessage="Actions"
        />
      ),
      rowCellRender: function RowCellRender({ rowIndex }) {
        const item = tableItems[rowIndex];
        const [isPopoverVisible, setIsPopoverVisible] = useState(false);
        const closePopover = () => setIsPopoverVisible(false);

        const actions = [
          <EuiContextMenuItem
            icon="discoverApp"
            key="custom_discover_url"
            disabled={discoverUrlError !== undefined}
            onClick={async () => {
              const openInDiscoverUrl = await generateDiscoverUrl(rowIndex);
              if (openInDiscoverUrl) {
                application.navigateToUrl(openInDiscoverUrl);
              }
            }}
          >
            {discoverUrlError ? (
              <EuiToolTip content={discoverUrlError}>
                <FormattedMessage
                  id="xpack.ml.dataframe.analytics.exploration.dataGridActions.viewInDiscover"
                  defaultMessage="View in Discover"
                />
              </EuiToolTip>
            ) : (
              <FormattedMessage
                id="xpack.ml.dataframe.analytics.exploration.dataGridActions.viewInDiscover"
                defaultMessage="View in Discover"
              />
            )}
          </EuiContextMenuItem>,
        ];

        if (jobConfig && jobConfig._meta && Array.isArray(jobConfig._meta.custom_urls)) {
          jobConfig?._meta.custom_urls.forEach((customUrl, index) => {
            actions.push(
              <EuiContextMenuItem
                key={`custom_url_${index}`}
                icon="popout"
                onClick={() => {
                  closePopover();
                  openCustomUrl(item, customUrl);
                }}
                data-test-subj={`mlExplorationDataGridRowActionCustomUrlButton_${index}`}
              >
                {customUrl.url_name}
              </EuiContextMenuItem>
            );
          });
        }

        return (
          <EuiPopover
            isOpen={isPopoverVisible}
            panelPaddingSize="none"
            anchorPosition="upCenter"
            button={
              <EuiButtonIcon
                aria-label="Show actions"
                iconType="gear"
                color="text"
                onClick={() => setIsPopoverVisible(!isPopoverVisible)}
              />
            }
            closePopover={closePopover}
          >
            <EuiContextMenuPanel items={actions} size="s" />
          </EuiPopover>
        );
      },
    },
  ];

  const renderCellPopover = useMemo(
    () =>
      renderCellPopoverFactory({
        analysisType,
        baseline: indexData.baseline,
        data: indexData.tableItems,
        pagination: indexData.pagination,
        predictionFieldName: indexData.predictionFieldName,
        resultsField: indexData.resultsField,
      }),
    [
      analysisType,
      indexData.baseline,
      indexData.tableItems,
      indexData.pagination,
      indexData.predictionFieldName,
      indexData.resultsField,
    ]
  );

  const resultsSectionContent = (
    <>
      {jobConfig !== undefined && needsDestIndexPattern && (
        <div className="mlExpandableSection-contentPadding">
          <IndexPatternPrompt destIndex={jobConfig.dest.index} />
        </div>
      )}
      {jobConfig !== undefined &&
        (isRegressionAnalysis(jobConfig.analysis) ||
          isClassificationAnalysis(jobConfig.analysis)) && (
          <EuiText size="xs" color="subdued" className="mlExpandableSection-contentPadding">
            {tableItems.length === SEARCH_SIZE ? showingFirstDocs : showingDocs}
          </EuiText>
        )}
      {(columnsWithCharts.length > 0 || searchQuery !== defaultSearchQuery) &&
        indexPattern !== undefined && (
          <>
            {columnsWithCharts.length > 0 &&
              (tableItems.length > 0 || status === INDEX_STATUS.LOADED) && (
                <DataGrid
                  {...indexData}
                  trailingControlColumns={
                    indexData.visibleColumns.length ? trailingControlColumns : undefined
                  }
                  dataTestSubj="mlExplorationDataGrid"
                  renderCellPopover={renderCellPopover}
                  toastNotifications={getToastNotifications()}
                />
              )}
          </>
        )}
    </>
  );

  return (
    <>
      <ExpandableSection
        urlStateKey={'results'}
        dataTestId="results"
        content={resultsSectionContent}
        headerItems={resultsSectionHeaderItems}
        title={
          <FormattedMessage
            id="xpack.ml.dataframe.analytics.exploration.explorationTableTitle"
            defaultMessage="Results"
          />
        }
      />
      <EuiSpacer size="m" />
    </>
  );
};
