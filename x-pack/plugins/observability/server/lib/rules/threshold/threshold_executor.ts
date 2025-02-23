/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import { ALERT_ACTION_GROUP, ALERT_EVALUATION_VALUES, ALERT_REASON } from '@kbn/rule-data-utils';
import { isEqual } from 'lodash';
import {
  ActionGroupIdsOf,
  AlertInstanceContext as AlertContext,
  AlertInstanceState as AlertState,
  RecoveredActionGroup,
} from '@kbn/alerting-plugin/common';
import { Alert, RuleTypeState } from '@kbn/alerting-plugin/server';
import { IBasePath, Logger } from '@kbn/core/server';
import { LifecycleRuleExecutor } from '@kbn/rule-registry-plugin/server';
import { TimeUnitChar } from '../../../../common';
import { createFormatter } from '../../../../common/threshold_rule/formatters';
import { Comparator } from '../../../../common/threshold_rule/types';
import { ObservabilityConfig } from '../../..';
import { getOriginalActionGroup } from './utils';
import { AlertStates } from './types';

import {
  buildFiredAlertReason,
  buildInvalidQueryAlertReason,
  buildNoDataAlertReason,
  // buildRecoveredAlertReason,
  stateToAlertMessage,
} from './messages';
import {
  createScopedLogger,
  AdditionalContext,
  getAlertDetailsUrl,
  getContextForRecoveredAlerts,
  getViewInMetricsAppUrl,
  UNGROUPED_FACTORY_KEY,
  hasAdditionalContext,
  validGroupByForContext,
  flattenAdditionalContext,
  getGroupByObject,
} from './utils';

import { EvaluatedRuleParams, evaluateRule } from './lib/evaluate_rule';
import { MissingGroupsRecord } from './lib/check_missing_group';
import { convertStringsToMissingGroupsRecord } from './lib/convert_strings_to_missing_groups_record';

export type MetricThresholdRuleParams = Record<string, any>;
export type MetricThresholdRuleTypeState = RuleTypeState & {
  lastRunTimestamp?: number;
  missingGroups?: Array<string | MissingGroupsRecord>;
  groupBy?: string | string[];
  filterQuery?: string;
};
export type MetricThresholdAlertState = AlertState; // no specific instance state used
export type MetricThresholdAlertContext = AlertContext; // no specific instance state used

export const FIRED_ACTIONS_ID = 'metrics.threshold.fired';
export const NO_DATA_ACTIONS_ID = 'metrics.threshold.nodata';

type MetricThresholdActionGroup =
  | typeof FIRED_ACTIONS_ID
  | typeof NO_DATA_ACTIONS_ID
  | typeof RecoveredActionGroup.id;

type MetricThresholdAllowedActionGroups = ActionGroupIdsOf<
  typeof FIRED_ACTIONS | typeof NO_DATA_ACTIONS
>;

type MetricThresholdAlert = Alert<
  MetricThresholdAlertState,
  MetricThresholdAlertContext,
  MetricThresholdAllowedActionGroups
>;

type MetricThresholdAlertFactory = (
  id: string,
  reason: string,
  actionGroup: MetricThresholdActionGroup,
  additionalContext?: AdditionalContext | null,
  evaluationValues?: Array<number | null>
) => MetricThresholdAlert;

export const createMetricThresholdExecutor = ({
  basePath,
  logger,
  config,
}: {
  basePath: IBasePath;
  logger: Logger;
  config: ObservabilityConfig;
}): LifecycleRuleExecutor<
  MetricThresholdRuleParams,
  MetricThresholdRuleTypeState,
  MetricThresholdAlertState,
  MetricThresholdAlertContext,
  MetricThresholdAllowedActionGroups
> =>
  async function (options) {
    const startTime = Date.now();

    const {
      services,
      params,
      state,
      startedAt,
      executionId,
      spaceId,
      rule: { id: ruleId },
    } = options;

    const { criteria } = params;
    if (criteria.length === 0) throw new Error('Cannot execute an alert with 0 conditions');
    const thresholdLogger = createScopedLogger(logger, 'thresholdRule', {
      alertId: ruleId,
      executionId,
    });

    // TODO: check if we need to use "savedObjectsClient"=> https://github.com/elastic/kibana/issues/159340
    const { alertWithLifecycle, getAlertUuid, getAlertByAlertUuid, dataViews } = services;

    const alertFactory: MetricThresholdAlertFactory = (
      id,
      reason,
      actionGroup,
      additionalContext,
      evaluationValues
    ) =>
      alertWithLifecycle({
        id,
        fields: {
          [ALERT_REASON]: reason,
          [ALERT_ACTION_GROUP]: actionGroup,
          [ALERT_EVALUATION_VALUES]: evaluationValues,
          ...flattenAdditionalContext(additionalContext),
        },
      });
    // TODO: check if we need to use "sourceId"
    const { alertOnNoData, alertOnGroupDisappear: _alertOnGroupDisappear } = params as {
      sourceId?: string;
      alertOnNoData: boolean;
      alertOnGroupDisappear: boolean | undefined;
    };

    if (!params.filterQuery && params.filterQueryText) {
      try {
        const { fromKueryExpression } = await import('@kbn/es-query');
        fromKueryExpression(params.filterQueryText);
      } catch (e) {
        thresholdLogger.error(e.message);
        const timestamp = startedAt.toISOString();
        const actionGroupId = FIRED_ACTIONS_ID; // Change this to an Error action group when able
        const reason = buildInvalidQueryAlertReason(params.filterQueryText);
        const alert = alertFactory(UNGROUPED_FACTORY_KEY, reason, actionGroupId);
        const alertUuid = getAlertUuid(UNGROUPED_FACTORY_KEY);

        alert.scheduleActions(actionGroupId, {
          alertDetailsUrl: getAlertDetailsUrl(basePath, spaceId, alertUuid),
          alertState: stateToAlertMessage[AlertStates.ERROR],
          group: UNGROUPED_FACTORY_KEY,
          metric: mapToConditionsLookup(criteria, (c) => c.metric),
          reason,
          timestamp,
          value: null,
          viewInAppUrl: getViewInMetricsAppUrl(basePath, spaceId),
        });

        return {
          state: {
            lastRunTimestamp: startedAt.valueOf(),
            missingGroups: [],
            groupBy: params.groupBy,
            filterQuery: params.filterQuery,
          },
        };
      }
    }

    // For backwards-compatibility, interpret undefined alertOnGroupDisappear as true
    const alertOnGroupDisappear = _alertOnGroupDisappear !== false;
    const compositeSize = config.thresholdRule.groupByPageSize;
    const filterQueryIsSame = isEqual(state.filterQuery, params.filterQuery);
    const groupByIsSame = isEqual(state.groupBy, params.groupBy);
    const previousMissingGroups =
      alertOnGroupDisappear && filterQueryIsSame && groupByIsSame && state.missingGroups
        ? state.missingGroups
        : [];
    // TODO: check the DATA VIEW
    const defaultDataView = await dataViews.getDefaultDataView();
    const dataView = defaultDataView?.getIndexPattern();
    if (!dataView) {
      throw new Error('No matched data view');
    }

    const alertResults = await evaluateRule(
      services.scopedClusterClient.asCurrentUser,
      params as EvaluatedRuleParams,
      dataView,
      compositeSize,
      alertOnGroupDisappear,
      logger,
      state.lastRunTimestamp,
      { end: startedAt.valueOf() },
      convertStringsToMissingGroupsRecord(previousMissingGroups)
    );

    const resultGroupSet = new Set<string>();
    for (const resultSet of alertResults) {
      for (const group of Object.keys(resultSet)) {
        resultGroupSet.add(group);
      }
    }

    const groupByKeysObjectMapping = getGroupByObject(params.groupBy, resultGroupSet);
    const groups = [...resultGroupSet];
    const nextMissingGroups = new Set<MissingGroupsRecord>();
    const hasGroups = !isEqual(groups, [UNGROUPED_FACTORY_KEY]);
    let scheduledActionsCount = 0;

    // The key of `groups` is the alert instance ID.
    for (const group of groups) {
      // AND logic; all criteria must be across the threshold
      const shouldAlertFire = alertResults.every((result) => result[group]?.shouldFire);
      // AND logic; because we need to evaluate all criteria, if one of them reports no data then the
      // whole alert is in a No Data/Error state
      const isNoData = alertResults.some((result) => result[group]?.isNoData);

      if (isNoData && group !== UNGROUPED_FACTORY_KEY) {
        nextMissingGroups.add({ key: group, bucketKey: alertResults[0][group].bucketKey });
      }

      const nextState = isNoData
        ? AlertStates.NO_DATA
        : shouldAlertFire
        ? AlertStates.ALERT
        : AlertStates.OK;

      let reason;
      if (nextState === AlertStates.ALERT) {
        reason = alertResults
          .map((result) =>
            buildFiredAlertReason({
              ...formatAlertResult(result[group]),
              group,
            })
          )
          .join('\n');
      }

      /* NO DATA STATE HANDLING
       *
       * - `alertOnNoData` does not indicate IF the alert's next state is No Data, but whether or not the user WANTS TO BE ALERTED
       *   if the state were No Data.
       * - `alertOnGroupDisappear`, on the other hand, determines whether or not it's possible to return a No Data state
       *   when a group disappears.
       *
       * This means we need to handle the possibility that `alertOnNoData` is false, but `alertOnGroupDisappear` is true
       *
       * nextState === NO_DATA would be true on both { '*': No Data } or, e.g. { 'a': No Data, 'b': OK, 'c': OK }, but if the user
       * has for some reason disabled `alertOnNoData` and left `alertOnGroupDisappear` enabled, they would only care about the latter
       * possibility. In this case, use hasGroups to determine whether to alert on a potential No Data state
       *
       * If `alertOnNoData` is true but `alertOnGroupDisappear` is false, we don't need to worry about the {a, b, c} possibility.
       * At this point in the function, a false `alertOnGroupDisappear` would already have prevented group 'a' from being evaluated at all.
       */
      if (alertOnNoData || (alertOnGroupDisappear && hasGroups)) {
        // In the previous line we've determined if the user is interested in No Data states, so only now do we actually
        // check to see if a No Data state has occurred
        if (nextState === AlertStates.NO_DATA) {
          reason = alertResults
            .filter((result) => result[group]?.isNoData)
            .map((result) => buildNoDataAlertReason({ ...result[group], group }))
            .join('\n');
        }
      }

      if (reason) {
        const timestamp = startedAt.toISOString();
        const actionGroupId: MetricThresholdActionGroup =
          nextState === AlertStates.OK
            ? RecoveredActionGroup.id
            : nextState === AlertStates.NO_DATA
            ? NO_DATA_ACTIONS_ID
            : FIRED_ACTIONS_ID;

        const additionalContext = hasAdditionalContext(params.groupBy, validGroupByForContext)
          ? alertResults && alertResults.length > 0
            ? alertResults[0][group].context ?? {}
            : {}
          : {};

        additionalContext.tags = Array.from(
          new Set([...(additionalContext.tags ?? []), ...options.rule.tags])
        );

        const evaluationValues = alertResults.reduce((acc: Array<number | null>, result) => {
          acc.push(result[group].currentValue);
          return acc;
        }, []);

        const alert = alertFactory(
          `${group}`,
          reason,
          actionGroupId,
          additionalContext,
          evaluationValues
        );
        const alertUuid = getAlertUuid(group);
        scheduledActionsCount++;

        alert.scheduleActions(actionGroupId, {
          alertDetailsUrl: getAlertDetailsUrl(basePath, spaceId, alertUuid),
          alertState: stateToAlertMessage[nextState],
          group,
          groupByKeys: groupByKeysObjectMapping[group],
          metric: mapToConditionsLookup(criteria, (c) => {
            if (c.aggType === 'count') {
              return 'count';
            }
            return c.metric;
          }),
          reason,
          threshold: mapToConditionsLookup(alertResults, (result, index) => {
            const evaluation = result[group];
            if (!evaluation) {
              return criteria[index].threshold;
            }
            return formatAlertResult(evaluation).threshold;
          }),
          timestamp,
          value: mapToConditionsLookup(alertResults, (result, index) => {
            const evaluation = result[group];
            if (!evaluation && criteria[index].aggType === 'count') {
              return 0;
            } else if (!evaluation) {
              return null;
            }
            return formatAlertResult(evaluation).currentValue;
          }),
          viewInAppUrl: getViewInMetricsAppUrl(basePath, spaceId),
          ...additionalContext,
        });
      }
    }
    const { getRecoveredAlerts } = services.alertFactory.done();
    const recoveredAlerts = getRecoveredAlerts();

    const groupByKeysObjectForRecovered = getGroupByObject(
      params.groupBy,
      new Set<string>(recoveredAlerts.map((recoveredAlert) => recoveredAlert.getId()))
    );

    for (const alert of recoveredAlerts) {
      const recoveredAlertId = alert.getId();
      const alertUuid = getAlertUuid(recoveredAlertId);

      const alertHits = alertUuid ? await getAlertByAlertUuid(alertUuid) : undefined;
      const additionalContext = getContextForRecoveredAlerts(alertHits);
      const originalActionGroup = getOriginalActionGroup(alertHits);

      alert.setContext({
        alertDetailsUrl: getAlertDetailsUrl(basePath, spaceId, alertUuid),
        alertState: stateToAlertMessage[AlertStates.OK],
        group: recoveredAlertId,
        groupByKeys: groupByKeysObjectForRecovered[recoveredAlertId],
        metric: mapToConditionsLookup(criteria, (c) => {
          if (criteria.aggType === 'count') {
            return 'count';
          }
          return c.metric;
        }),
        timestamp: startedAt.toISOString(),
        threshold: mapToConditionsLookup(criteria, (c) => c.threshold),
        viewInAppUrl: getViewInMetricsAppUrl(basePath, spaceId),

        originalAlertState: translateActionGroupToAlertState(originalActionGroup),
        originalAlertStateWasALERT: originalActionGroup === FIRED_ACTIONS.id,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        originalAlertStateWasNO_DATA: originalActionGroup === NO_DATA_ACTIONS.id,
        ...additionalContext,
      });
    }

    const stopTime = Date.now();
    thresholdLogger.debug(
      `Scheduled ${scheduledActionsCount} actions in ${stopTime - startTime}ms`
    );
    return {
      state: {
        lastRunTimestamp: startedAt.valueOf(),
        missingGroups: [...nextMissingGroups],
        groupBy: params.groupBy,
        filterQuery: params.filterQuery,
      },
    };
  };

export const FIRED_ACTIONS = {
  id: 'metrics.threshold.fired',
  name: i18n.translate('xpack.observability.threshold.rule.alerting.threshold.fired', {
    defaultMessage: 'Alert',
  }),
};

export const NO_DATA_ACTIONS = {
  id: 'metrics.threshold.nodata',
  name: i18n.translate('xpack.observability.threshold.rule.alerting.threshold.nodata', {
    defaultMessage: 'No Data',
  }),
};

const translateActionGroupToAlertState = (
  actionGroupId: string | undefined
): string | undefined => {
  if (actionGroupId === FIRED_ACTIONS.id) {
    return stateToAlertMessage[AlertStates.ALERT];
  }
  if (actionGroupId === NO_DATA_ACTIONS.id) {
    return stateToAlertMessage[AlertStates.NO_DATA];
  }
};

const mapToConditionsLookup = (
  list: any[],
  mapFn: (value: any, index: number, array: any[]) => unknown
) =>
  list.map(mapFn).reduce((result: Record<string, any>, value, i) => {
    result[`condition${i}`] = value;
    return result;
  }, {} as Record<string, unknown>);

const formatAlertResult = <AlertResult>(
  alertResult: {
    metric: string;
    currentValue: number | null;
    threshold: number[];
    comparator: Comparator;
    timeSize: number;
    timeUnit: TimeUnitChar;
  } & AlertResult
) => {
  const { metric, currentValue, threshold, comparator } = alertResult;
  const noDataValue = i18n.translate(
    'xpack.observability.threshold.rule.alerting.threshold.noDataFormattedValue',
    { defaultMessage: '[NO DATA]' }
  );

  if (metric.endsWith('.pct')) {
    const formatter = createFormatter('percent');
    return {
      ...alertResult,
      currentValue:
        currentValue !== null && currentValue !== undefined ? formatter(currentValue) : noDataValue,
      threshold: Array.isArray(threshold)
        ? threshold.map((v: number) => formatter(v))
        : formatter(threshold),
      comparator,
    };
  }

  const formatter = createFormatter('highPrecision');
  return {
    ...alertResult,
    currentValue:
      currentValue !== null && currentValue !== undefined ? formatter(currentValue) : noDataValue,
    threshold: Array.isArray(threshold)
      ? threshold.map((v: number) => formatter(v))
      : formatter(threshold),
    comparator,
  };
};
