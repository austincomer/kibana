/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo } from 'react';
import moment from 'moment';
import { i18n } from '@kbn/i18n';
import {
  Axis,
  Chart,
  niceTimeFormatter,
  Position,
  Settings,
  BrushEndListener,
  TooltipProps,
} from '@elastic/charts';
import { EuiPageContentBody_Deprecated as EuiPageContentBody } from '@elastic/eui';
import { useIsDarkMode } from '../../../../hooks/use_is_dark_mode';
import { SeriesChart } from './series_chart';
import {
  getFormatter,
  getMaxMinTimestamp,
  getChartName,
  getChartColor,
  getChartType,
  seriesHasLessThen2DataPoints,
} from './helpers';
import { ErrorMessage } from './error_message';
import { getChartTheme } from '../../../../utils/get_chart_theme';
import { useKibanaUiSetting } from '../../../../utils/use_kibana_ui_setting';
import { VisSectionProps } from '../types';

export const ChartSectionVis = ({
  id,
  onChangeRangeTime,
  metric,
  stopLiveStreaming,
  isLiveStreaming,
  formatter,
  formatterTemplate,
  stacked,
  seriesOverrides,
  type,
}: VisSectionProps) => {
  const isDarkMode = useIsDarkMode();
  const [dateFormat] = useKibanaUiSetting('dateFormat');
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  const valueFormatter = useCallback(getFormatter(formatter, formatterTemplate), [
    formatter,
    formatterTemplate,
  ]);
  const dateFormatter = useMemo(
    () => (metric != null ? niceTimeFormatter(getMaxMinTimestamp(metric)) : undefined),
    [metric]
  );
  const handleTimeChange = useCallback<BrushEndListener>(
    ({ x }) => {
      if (!x) {
        return;
      }
      const [from, to] = x;
      if (onChangeRangeTime) {
        if (isLiveStreaming && stopLiveStreaming) {
          stopLiveStreaming();
        }
        onChangeRangeTime({
          from: moment(from).toISOString(),
          to: moment(to).toISOString(),
          interval: '>=1m',
        });
      }
    },
    [onChangeRangeTime, isLiveStreaming, stopLiveStreaming]
  );
  const tooltipProps: TooltipProps = {
    headerFormatter: useCallback<NonNullable<TooltipProps['headerFormatter']>>(
      ({ value }) => moment(value).format(dateFormat || 'Y-MM-DD HH:mm:ss.SSS'),
      [dateFormat]
    ),
  };

  if (!id) {
    return null;
  } else if (!metric) {
    return (
      <ErrorMessage
        title={i18n.translate('xpack.infra.chartSection.missingMetricDataText', {
          defaultMessage: 'Missing Data',
        })}
        body={i18n.translate('xpack.infra.chartSection.missingMetricDataBody', {
          defaultMessage: 'The data for this chart is missing.',
        })}
      />
    );
  } else if (metric.series.some(seriesHasLessThen2DataPoints)) {
    return (
      <ErrorMessage
        title={i18n.translate('xpack.infra.chartSection.notEnoughDataPointsToRenderTitle', {
          defaultMessage: 'Not Enough Data',
        })}
        body={i18n.translate('xpack.infra.chartSection.notEnoughDataPointsToRenderText', {
          defaultMessage: 'Not enough data points to render chart, try increasing the time range.',
        })}
      />
    );
  }

  return (
    <EuiPageContentBody>
      <div className="infrastructureChart" style={{ height: 250, marginBottom: 16 }}>
        <Chart>
          <Axis
            id="timestamp"
            position={Position.Bottom}
            showOverlappingTicks={true}
            tickFormat={dateFormatter}
          />
          <Axis id="values" position={Position.Left} tickFormat={valueFormatter} />
          {metric &&
            metric.series.map((series) => (
              <SeriesChart
                key={`series-${id}-${series.id}`}
                id={`series-${id}-${series.id}`}
                series={series}
                name={getChartName(seriesOverrides, series.id, series.id)}
                type={getChartType(seriesOverrides, type, series.id)}
                color={getChartColor(seriesOverrides, series.id)}
                stack={stacked}
              />
            ))}
          <Settings
            tooltip={tooltipProps}
            onBrushEnd={handleTimeChange}
            theme={getChartTheme(isDarkMode)}
            showLegend
            showLegendExtra
            legendPosition="right"
          />
        </Chart>
      </div>
    </EuiPageContentBody>
  );
};
