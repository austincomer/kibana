/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiErrorBoundary } from '@elastic/eui';
import { Theme, ThemeProvider } from '@emotion/react';
import {
  AppMountParameters,
  APP_WRAPPER_CLASS,
  CoreStart,
} from '@kbn/core/public';
import { i18n } from '@kbn/i18n';
import {
  KibanaContextProvider,
  KibanaThemeProvider,
  RedirectAppLinks,
  useUiSetting$,
} from '@kbn/kibana-react-plugin/public';
import { HeaderMenuPortal } from '@kbn/observability-shared-plugin/public';
import { Route } from '@kbn/shared-ux-router';
import { euiDarkVars, euiLightVars } from '@kbn/ui-theme';
import React from 'react';
import ReactDOM from 'react-dom';
import {
  RouteComponentProps,
  RouteProps,
  Router,
  Switch,
} from 'react-router-dom';
import { ObservabilityOnboardingHeaderActionMenu } from '../components/app/header_action_menu';
import {
  ObservabilityOnboardingPluginSetupDeps,
  ObservabilityOnboardingPluginStartDeps,
} from '../plugin';
import { routes } from '../routes';

export type BreadcrumbTitle<
  T extends { [K in keyof T]?: string | undefined } = {}
> = string | ((props: RouteComponentProps<T>) => string) | null;

export interface RouteDefinition<
  T extends { [K in keyof T]?: string | undefined } = any
> extends RouteProps {
  breadcrumb: BreadcrumbTitle<T>;
}

export const onBoardingTitle = i18n.translate(
  'xpack.observability_onboarding.breadcrumbs.onboarding',
  {
    defaultMessage: 'Onboarding',
  }
);

export const breadcrumbsApp = {
  id: 'observabilityOnboarding',
  label: onBoardingTitle,
};

function App() {
  return (
    <>
      <Switch>
        {Object.keys(routes).map((key) => {
          const path = key as keyof typeof routes;
          const { handler, exact } = routes[path];
          const Wrapper = () => {
            return handler();
          };
          return (
            <Route key={path} path={path} exact={exact} component={Wrapper} />
          );
        })}
      </Switch>
    </>
  );
}

function ObservabilityOnboardingApp() {
  const [darkMode] = useUiSetting$<boolean>('theme:darkMode');

  return (
    <ThemeProvider
      theme={(outerTheme?: Theme) => ({
        ...outerTheme,
        eui: darkMode ? euiDarkVars : euiLightVars,
        darkMode,
      })}
    >
      <div className={APP_WRAPPER_CLASS} data-test-subj="csmMainContainer">
        <App />
      </div>
    </ThemeProvider>
  );
}

export function ObservabilityOnboardingAppRoot({
  appMountParameters,
  core,
  deps,
  corePlugins: { observability, data },
}: {
  appMountParameters: AppMountParameters;
  core: CoreStart;
  deps: ObservabilityOnboardingPluginSetupDeps;
  corePlugins: ObservabilityOnboardingPluginStartDeps;
}) {
  const { history, setHeaderActionMenu, theme$ } = appMountParameters;
  const i18nCore = core.i18n;
  const plugins = { ...deps };

  return (
    <RedirectAppLinks
      className={APP_WRAPPER_CLASS}
      application={core.application}
    >
      <KibanaContextProvider
        services={{
          ...core,
          ...plugins,
          observability,
          data,
        }}
      >
        <KibanaThemeProvider
          theme$={theme$}
          modify={{
            breakpoint: {
              xxl: 1600,
              xxxl: 2000,
            },
          }}
        >
          <i18nCore.Context>
            <Router history={history}>
              <EuiErrorBoundary>
                <HeaderMenuPortal
                  setHeaderActionMenu={setHeaderActionMenu}
                  theme$={theme$}
                >
                  <ObservabilityOnboardingHeaderActionMenu />
                </HeaderMenuPortal>
                <ObservabilityOnboardingApp />
              </EuiErrorBoundary>
            </Router>
          </i18nCore.Context>
        </KibanaThemeProvider>
      </KibanaContextProvider>
    </RedirectAppLinks>
  );
}

/**
 * This module is rendered asynchronously in the Kibana platform.
 */

export const renderApp = ({
  core,
  deps,
  appMountParameters,
  corePlugins,
}: {
  core: CoreStart;
  deps: ObservabilityOnboardingPluginSetupDeps;
  appMountParameters: AppMountParameters;
  corePlugins: ObservabilityOnboardingPluginStartDeps;
}) => {
  const { element } = appMountParameters;

  ReactDOM.render(
    <ObservabilityOnboardingAppRoot
      appMountParameters={appMountParameters}
      core={core}
      deps={deps}
      corePlugins={corePlugins}
    />,
    element
  );
  return () => {
    corePlugins.data.search.session.clear();
    ReactDOM.unmountComponentAtNode(element);
  };
};
