/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import DateMath from '@kbn/datemath';
import { DataViewBase } from '@kbn/es-query';
import { useMemo } from 'react';
import { MetricExplorerCustomMetricAggregations } from '../../../../common/threshold_rule/metrics_explorer';
import {
  MetricExpressionCustomMetric,
  MetricsSourceConfiguration,
} from '../../../../common/threshold_rule/types';
import { MetricExpression, TimeRange } from '../types';
import { useMetricsExplorerData } from './use_metrics_explorer_data';

import {
  MetricsExplorerOptions,
  MetricsExplorerTimestampsRT,
} from './use_metrics_explorer_options';

const DEFAULT_TIME_RANGE = {};

export const useMetricsExplorerChartData = (
  expression: MetricExpression,
  derivedIndexPattern: DataViewBase,
  source?: MetricsSourceConfiguration,
  filterQuery?: string,
  groupBy?: string | string[],
  timeRange: TimeRange = DEFAULT_TIME_RANGE
) => {
  const { timeSize, timeUnit } = expression || { timeSize: 1, timeUnit: 'm' };

  const options: MetricsExplorerOptions = useMemo(
    () => ({
      limit: 1,
      forceInterval: true,
      dropLastBucket: false,
      groupBy,
      filterQuery,
      metrics: [
        expression.aggType === 'custom'
          ? {
              aggregation: 'custom',
              custom_metrics:
                expression?.customMetrics?.map(mapMetricThresholdMetricToMetricsExplorerMetric) ??
                [],
              equation: expression.equation,
            }
          : { field: expression.metric, aggregation: expression.aggType },
      ],
      aggregation: expression.aggType || 'avg',
    }),
    [
      expression.aggType,
      expression.equation,
      expression.metric,
      expression.customMetrics,
      filterQuery,
      groupBy,
    ]
  );
  const timestamps: MetricsExplorerTimestampsRT = useMemo(() => {
    const from = timeRange.from ?? `now-${(timeSize || 1) * 20}${timeUnit}`;
    const to = timeRange.to ?? 'now';
    const fromTimestamp = DateMath.parse(from)!.valueOf();
    const toTimestamp = DateMath.parse(to, { roundUp: true })!.valueOf();
    return {
      interval: `>=${timeSize || 1}${timeUnit}`,
      fromTimestamp,
      toTimestamp,
    };
  }, [timeRange, timeSize, timeUnit]);

  return useMetricsExplorerData(options, source?.configuration, derivedIndexPattern, timestamps);
};

const mapMetricThresholdMetricToMetricsExplorerMetric = (metric: MetricExpressionCustomMetric) => {
  if (metric.aggType === 'count') {
    return {
      name: metric.name,
      aggregation: 'count' as MetricExplorerCustomMetricAggregations,
      filter: metric.filter,
    };
  }

  return {
    name: metric.name,
    aggregation: metric.aggType as MetricExplorerCustomMetricAggregations,
    field: metric.field,
  };
};
