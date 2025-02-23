/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import type { DataView } from '@kbn/data-views-plugin/public';
import type { SavedSearch } from '@kbn/saved-search-plugin/public';
import { Query, Filter } from '@kbn/es-query';
import { getToastNotifications, getSavedSearch, getDataViews } from './dependency_cache';

export async function loadSavedSearchById(id: string) {
  return getSavedSearch().get(id);
}

export async function getDataViewNames() {
  const dataViewsContract = getDataViews();
  if (dataViewsContract === null) {
    throw new Error('Data views are not initialized!');
  }
  return (await dataViewsContract.getIdsWithTitle()).map(({ title }) => title);
}

export async function getDataViewIdFromName(name: string): Promise<string | null> {
  const dataViewsContract = getDataViews();
  if (dataViewsContract === null) {
    throw new Error('Data views are not initialized!');
  }
  const dataViews = await dataViewsContract.find(name);
  const dataView = dataViews.find((dv) => dv.getIndexPattern() === name);
  if (!dataView) {
    return null;
  }
  return dataView.id ?? dataView.getIndexPattern();
}

export function getDataViewById(id: string): Promise<DataView> {
  const dataViewsContract = getDataViews();
  if (dataViewsContract === null) {
    throw new Error('Data views are not initialized!');
  }

  if (id) {
    return dataViewsContract.get(id);
  } else {
    return dataViewsContract.create({});
  }
}

export interface DataViewAndSavedSearch {
  savedSearch: SavedSearch | null;
  dataView: DataView | null;
}

export async function getDataViewAndSavedSearch(savedSearchId: string) {
  const resp: DataViewAndSavedSearch = {
    savedSearch: null,
    dataView: null,
  };

  if (savedSearchId === undefined) {
    return resp;
  }

  const ss = await loadSavedSearchById(savedSearchId);
  if (ss === null) {
    return resp;
  }
  const dataViewId = ss.references?.find((r) => r.type === 'index-pattern')?.id;
  resp.dataView = await getDataViewById(dataViewId!);
  resp.savedSearch = ss;
  return resp;
}

export function getQueryFromSavedSearchObject(savedSearch: SavedSearch) {
  return {
    query: savedSearch.searchSource.getField('query')! as Query,
    filter: savedSearch.searchSource.getField('filter') as Filter[],
  };
}

export function getSavedSearchById(id: string): Promise<SavedSearch> {
  return getSavedSearch().get(id);
}

/**
 * Returns true if the index passed in is time based
 * an optional flag will trigger the display a notification at the top of the page
 * warning that the index is not time based
 */
export function timeBasedIndexCheck(dataView: DataView, showNotification = false) {
  if (!dataView.isTimeBased()) {
    if (showNotification) {
      const toastNotifications = getToastNotifications();
      toastNotifications.addWarning({
        title: i18n.translate('xpack.ml.dataViewNotBasedOnTimeSeriesNotificationTitle', {
          defaultMessage: 'The data view {dataViewIndexPattern} is not based on a time series',
          values: { dataViewIndexPattern: dataView.getIndexPattern() },
        }),
        text: i18n.translate('xpack.ml.dataViewNotBasedOnTimeSeriesNotificationDescription', {
          defaultMessage: 'Anomaly detection only runs over time-based indices',
        }),
      });
    }
    return false;
  } else {
    return true;
  }
}

/**
 * Returns true if the data view index pattern contains a :
 * which means it is cross-cluster
 */
export function isCcsIndexPattern(dataViewIndexPattern: string) {
  return dataViewIndexPattern.includes(':');
}
