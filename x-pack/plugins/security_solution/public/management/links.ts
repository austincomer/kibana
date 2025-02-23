/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { CoreStart } from '@kbn/core/public';
import { i18n } from '@kbn/i18n';

import { checkArtifactHasData } from './services/exceptions_list/check_artifact_has_data';
import {
  calculateEndpointAuthz,
  getEndpointAuthzInitialState,
} from '../../common/endpoint/service/authz';
import {
  BLOCKLIST_PATH,
  ENDPOINTS_PATH,
  EVENT_FILTERS_PATH,
  EXCEPTIONS_PATH,
  HOST_ISOLATION_EXCEPTIONS_PATH,
  MANAGE_PATH,
  POLICIES_PATH,
  RESPONSE_ACTIONS_HISTORY_PATH,
  RULES_ADD_PATH,
  RULES_CREATE_PATH,
  RULES_PATH,
  SecurityPageName,
  SERVER_APP_ID,
  TRUSTED_APPS_PATH,
} from '../../common/constants';
import {
  ADD_RULES,
  BLOCKLIST,
  CREATE_NEW_RULE,
  ENDPOINTS,
  EVENT_FILTERS,
  EXCEPTIONS,
  HOST_ISOLATION_EXCEPTIONS,
  MANAGE,
  POLICIES,
  RESPONSE_ACTIONS_HISTORY,
  RULES,
  TRUSTED_APPLICATIONS,
} from '../app/translations';
import { licenseService } from '../common/hooks/use_license';
import type { LinkItem } from '../common/links/types';
import type { StartPlugins } from '../types';
import {
  manageCategories as cloudSecurityPostureCategories,
  manageLinks as cloudSecurityPostureLinks,
} from '../cloud_security_posture/links';
import { manageLinks as cloudDefendLinks } from '../cloud_defend/links';
import { IconActionHistory } from './icons/action_history';
import { IconBlocklist } from './icons/blocklist';
import { IconEndpoints } from './icons/endpoints';
import { IconEndpointPolicies } from './icons/endpoint_policies';
import { IconEventFilters } from './icons/event_filters';
import { IconExceptionLists } from './icons/exception_lists';
import { IconHostIsolation } from './icons/host_isolation';
import { IconSiemRules } from './icons/siem_rules';
import { IconTrustedApplications } from './icons/trusted_applications';
import { HostIsolationExceptionsApiClient } from './pages/host_isolation_exceptions/host_isolation_exceptions_api_client';

const categories = [
  {
    label: i18n.translate('xpack.securitySolution.appLinks.category.siem', {
      defaultMessage: 'SIEM',
    }),
    linkIds: [SecurityPageName.rules, SecurityPageName.exceptions],
  },
  {
    label: i18n.translate('xpack.securitySolution.appLinks.category.endpoints', {
      defaultMessage: 'ENDPOINTS',
    }),
    linkIds: [
      SecurityPageName.endpoints,
      SecurityPageName.policies,
      SecurityPageName.trustedApps,
      SecurityPageName.eventFilters,
      SecurityPageName.hostIsolationExceptions,
      SecurityPageName.blocklist,
      SecurityPageName.responseActionsHistory,
    ],
  },
  ...cloudSecurityPostureCategories,
];

export const links: LinkItem = {
  id: SecurityPageName.administration,
  title: MANAGE,
  path: MANAGE_PATH,
  skipUrlState: true,
  hideTimeline: true,
  globalNavPosition: 8,
  capabilities: [`${SERVER_APP_ID}.show`],
  globalSearchKeywords: [
    i18n.translate('xpack.securitySolution.appLinks.manage', {
      defaultMessage: 'Manage',
    }),
  ],
  categories,
  links: [
    {
      id: SecurityPageName.rules,
      title: RULES,
      description: i18n.translate('xpack.securitySolution.appLinks.rulesDescription', {
        defaultMessage:
          "Create and manage rules to check for suspicious source events, and create alerts when a rule's conditions are met.",
      }),

      landingIcon: IconSiemRules,
      path: RULES_PATH,
      globalSearchKeywords: [
        i18n.translate('xpack.securitySolution.appLinks.rules', {
          defaultMessage: 'Rules',
        }),
      ],
      links: [
        {
          id: SecurityPageName.rulesAdd,
          title: ADD_RULES,
          path: RULES_ADD_PATH,
          skipUrlState: true,
          hideTimeline: true,
        },
        {
          id: SecurityPageName.rulesCreate,
          title: CREATE_NEW_RULE,
          path: RULES_CREATE_PATH,
          skipUrlState: true,
          hideTimeline: true,
        },
      ],
    },
    {
      id: SecurityPageName.exceptions,
      title: EXCEPTIONS,
      description: i18n.translate('xpack.securitySolution.appLinks.exceptionsDescription', {
        defaultMessage:
          'Create and manage shared exception lists to prevent the creation of unwanted alerts.',
      }),
      landingIcon: IconExceptionLists,
      path: EXCEPTIONS_PATH,
      skipUrlState: true,
      hideTimeline: true,
      globalSearchKeywords: [
        i18n.translate('xpack.securitySolution.appLinks.exceptions', {
          defaultMessage: 'Exception lists',
        }),
      ],
    },
    {
      id: SecurityPageName.endpoints,
      description: i18n.translate('xpack.securitySolution.appLinks.endpointsDescription', {
        defaultMessage: 'Hosts running Elastic Defend.',
      }),
      landingIcon: IconEndpoints,
      title: ENDPOINTS,
      path: ENDPOINTS_PATH,
      skipUrlState: true,
      hideTimeline: true,
    },
    {
      id: SecurityPageName.policies,
      title: POLICIES,
      description: i18n.translate('xpack.securitySolution.appLinks.policiesDescription', {
        defaultMessage:
          'Use policies to customize endpoint and cloud workload protections and other configurations.',
      }),
      landingIcon: IconEndpointPolicies,
      path: POLICIES_PATH,
      skipUrlState: true,
      hideTimeline: true,
    },
    {
      id: SecurityPageName.trustedApps,
      title: TRUSTED_APPLICATIONS,
      description: i18n.translate(
        'xpack.securitySolution.appLinks.trustedApplicationsDescription',
        {
          defaultMessage:
            'Improve performance or alleviate conflicts with other applications running on your hosts.',
        }
      ),
      landingIcon: IconTrustedApplications,
      path: TRUSTED_APPS_PATH,
      skipUrlState: true,
      hideTimeline: true,
    },
    {
      id: SecurityPageName.eventFilters,
      title: EVENT_FILTERS,
      description: i18n.translate('xpack.securitySolution.appLinks.eventFiltersDescription', {
        defaultMessage: 'Exclude high volume or unwanted events being written into Elasticsearch.',
      }),
      landingIcon: IconEventFilters,
      path: EVENT_FILTERS_PATH,
      skipUrlState: true,
      hideTimeline: true,
    },
    {
      id: SecurityPageName.hostIsolationExceptions,
      title: HOST_ISOLATION_EXCEPTIONS,
      description: i18n.translate('xpack.securitySolution.appLinks.hostIsolationDescription', {
        defaultMessage: 'Allow isolated hosts to communicate with specific IPs.',
      }),
      landingIcon: IconHostIsolation,
      path: HOST_ISOLATION_EXCEPTIONS_PATH,
      skipUrlState: true,
      hideTimeline: true,
    },
    {
      id: SecurityPageName.blocklist,
      title: BLOCKLIST,
      description: i18n.translate('xpack.securitySolution.appLinks.blocklistDescription', {
        defaultMessage: 'Exclude unwanted applications from running on your hosts.',
      }),
      landingIcon: IconBlocklist,
      path: BLOCKLIST_PATH,
      skipUrlState: true,
      hideTimeline: true,
    },
    {
      id: SecurityPageName.responseActionsHistory,
      title: RESPONSE_ACTIONS_HISTORY,
      description: i18n.translate('xpack.securitySolution.appLinks.actionHistoryDescription', {
        defaultMessage: 'View the history of response actions performed on hosts.',
      }),
      landingIcon: IconActionHistory,
      path: RESPONSE_ACTIONS_HISTORY_PATH,
      skipUrlState: true,
      hideTimeline: true,
    },
    cloudSecurityPostureLinks,
    cloudDefendLinks,
  ],
};

const excludeLinks = (linkIds: SecurityPageName[]) => ({
  ...links,
  links: links.links?.filter((link) => !linkIds.includes(link.id)),
});

export const getManagementFilteredLinks = async (
  core: CoreStart,
  plugins: StartPlugins
): Promise<LinkItem> => {
  const fleetAuthz = plugins.fleet?.authz;
  const currentUser = await plugins.security.authc.getCurrentUser();
  const {
    canReadActionsLogManagement,
    canAccessHostIsolationExceptions,
    canReadHostIsolationExceptions,
    canReadEndpointList,
    canReadTrustedApplications,
    canReadEventFilters,
    canReadBlocklist,
    canReadPolicyManagement,
  } =
    fleetAuthz && currentUser
      ? calculateEndpointAuthz(licenseService, fleetAuthz, currentUser.roles)
      : getEndpointAuthzInitialState();

  const showHostIsolationExceptions =
    canAccessHostIsolationExceptions || // access host isolation exceptions is a paid feature, always show the link.
    // read host isolation exceptions is not a paid feature, to allow deleting exceptions after a downgrade scenario.
    // however, in this situation we allow to access only when there is data, otherwise the link won't be accessible.
    (canReadHostIsolationExceptions &&
      (await checkArtifactHasData(HostIsolationExceptionsApiClient.getInstance(core.http))));

  const linksToExclude: SecurityPageName[] = [];

  if (!canReadEndpointList) {
    linksToExclude.push(SecurityPageName.endpoints);
  }

  if (!canReadPolicyManagement) {
    linksToExclude.push(SecurityPageName.policies);
  }

  if (!canReadActionsLogManagement) {
    linksToExclude.push(SecurityPageName.responseActionsHistory);
  }

  if (!showHostIsolationExceptions) {
    linksToExclude.push(SecurityPageName.hostIsolationExceptions);
  }

  if (!canReadTrustedApplications) {
    linksToExclude.push(SecurityPageName.trustedApps);
  }

  if (!canReadEventFilters) {
    linksToExclude.push(SecurityPageName.eventFilters);
  }

  if (!canReadBlocklist) {
    linksToExclude.push(SecurityPageName.blocklist);
  }

  return excludeLinks(linksToExclude);
};
