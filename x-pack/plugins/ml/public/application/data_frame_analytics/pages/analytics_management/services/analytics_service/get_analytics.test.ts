/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { DATA_FRAME_TASK_STATE } from '@kbn/ml-data-frame-analytics-utils';
import { GetDataFrameAnalyticsStatsResponseOk } from '../../../../../services/ml_api_service/data_frame_analytics';
import { getAnalyticsJobsStats } from './get_analytics';

describe('get_analytics', () => {
  test('should get analytics jobs stats', () => {
    // arrange
    const mockResponse: GetDataFrameAnalyticsStatsResponseOk = {
      count: 2,
      data_frame_analytics: [
        // @ts-expect-error test response missing expected properties
        {
          id: 'outlier-cloudwatch',
          state: DATA_FRAME_TASK_STATE.STOPPED,
          progress: [
            {
              phase: 'reindexing',
              progress_percent: 0,
            },
            {
              phase: 'loading_data',
              progress_percent: 0,
            },
            {
              phase: 'analyzing',
              progress_percent: 0,
            },
            {
              phase: 'writing_results',
              progress_percent: 0,
            },
          ],
        },
        // @ts-expect-error test response missing expected properties
        {
          id: 'reg-gallery',
          state: DATA_FRAME_TASK_STATE.FAILED,
          progress: [
            {
              phase: 'reindexing',
              progress_percent: 0,
            },
            {
              phase: 'loading_data',
              progress_percent: 0,
            },
            {
              phase: 'analyzing',
              progress_percent: 0,
            },
            {
              phase: 'writing_results',
              progress_percent: 0,
            },
          ],
        },
      ],
    };

    // act and assert
    expect(getAnalyticsJobsStats(mockResponse)).toEqual({
      total: {
        label: 'Total analytics jobs',
        value: 2,
        show: true,
      },
      started: {
        label: 'Running',
        value: 0,
        show: true,
      },
      stopped: {
        label: 'Stopped',
        value: 1,
        show: true,
      },
      failed: {
        label: 'Failed',
        value: 1,
        show: true,
      },
    });
  });
});
