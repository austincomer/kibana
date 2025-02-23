/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiButtonIcon,
  EuiToolTip,
  EuiHighlight,
  EuiComboBox,
  EuiComboBoxOptionOption,
  EuiIcon,
} from '@elastic/eui';

import { css } from '@emotion/react';
import { Prompt } from '../../../../../..';
import * as i18n from './translations';
import { SYSTEM_PROMPT_DEFAULT_NEW_CONVERSATION } from '../translations';

export const SYSTEM_PROMPT_SELECTOR_CLASSNAME = 'systemPromptSelector';

interface Props {
  onSystemPromptDeleted: (systemPromptTitle: string) => void;
  onSystemPromptSelectionChange: (systemPrompt?: Prompt | string) => void;
  systemPrompts: Prompt[];
  selectedSystemPrompt?: Prompt;
}

export type SystemPromptSelectorOption = EuiComboBoxOptionOption<{
  isDefault: boolean;
  isNewConversationDefault: boolean;
}>;

/**
 * Selector for choosing and deleting System Prompts
 */
export const SystemPromptSelector: React.FC<Props> = React.memo(
  ({
    systemPrompts,
    onSystemPromptDeleted,
    onSystemPromptSelectionChange,
    selectedSystemPrompt,
  }) => {
    // Form options
    const [options, setOptions] = useState<SystemPromptSelectorOption[]>(
      systemPrompts.map((sp) => ({
        value: {
          isDefault: sp.isDefault ?? false,
          isNewConversationDefault: sp.isNewConversationDefault ?? false,
        },
        label: sp.name,
      }))
    );
    const selectedOptions = useMemo<SystemPromptSelectorOption[]>(() => {
      return selectedSystemPrompt
        ? [
            {
              value: {
                isDefault: selectedSystemPrompt.isDefault ?? false,
                isNewConversationDefault: selectedSystemPrompt.isNewConversationDefault ?? false,
              },
              label: selectedSystemPrompt.name,
            },
          ]
        : [];
    }, [selectedSystemPrompt]);

    const handleSelectionChange = useCallback(
      (systemPromptSelectorOption: SystemPromptSelectorOption[]) => {
        const newSystemPrompt =
          systemPromptSelectorOption.length === 0
            ? undefined
            : systemPrompts.find((sp) => sp.name === systemPromptSelectorOption[0]?.label) ??
              systemPromptSelectorOption[0]?.label;
        onSystemPromptSelectionChange(newSystemPrompt);
      },
      [onSystemPromptSelectionChange, systemPrompts]
    );

    // Callback for when user types to create a new system prompt
    const onCreateOption = useCallback(
      (searchValue, flattenedOptions = []) => {
        if (!searchValue || !searchValue.trim().toLowerCase()) {
          return;
        }

        const normalizedSearchValue = searchValue.trim().toLowerCase();
        const optionExists =
          flattenedOptions.findIndex(
            (option: SystemPromptSelectorOption) =>
              option.label.trim().toLowerCase() === normalizedSearchValue
          ) !== -1;

        const newOption = {
          value: searchValue,
          label: searchValue,
        };

        if (!optionExists) {
          setOptions([...options, newOption]);
        }
        handleSelectionChange([newOption]);
      },
      [handleSelectionChange, options]
    );

    // Callback for when user selects a quick prompt
    const onChange = useCallback(
      (newOptions: SystemPromptSelectorOption[]) => {
        if (newOptions.length === 0) {
          handleSelectionChange([]);
        } else if (options.findIndex((o) => o.label === newOptions?.[0].label) !== -1) {
          handleSelectionChange(newOptions);
        }
      },
      [handleSelectionChange, options]
    );

    // Callback for when user deletes a quick prompt
    const onDelete = useCallback(
      (label: string) => {
        setOptions(options.filter((o) => o.label !== label));
        if (selectedOptions?.[0]?.label === label) {
          handleSelectionChange([]);
        }
        onSystemPromptDeleted(label);
      },
      [handleSelectionChange, onSystemPromptDeleted, options, selectedOptions]
    );

    const renderOption: (
      option: SystemPromptSelectorOption,
      searchValue: string,
      OPTION_CONTENT_CLASSNAME: string
    ) => React.ReactNode = (option, searchValue, contentClassName) => {
      const { label, value } = option;
      return (
        <EuiFlexGroup
          alignItems="center"
          className={'parentFlexGroup'}
          component={'span'}
          gutterSize={'none'}
          justifyContent="spaceBetween"
        >
          <EuiFlexItem grow={1} component={'span'}>
            <EuiFlexGroup alignItems="center" component={'span'} gutterSize={'s'}>
              <EuiFlexItem grow={false} component={'span'}>
                <span className={contentClassName}>
                  <EuiHighlight
                    search={searchValue}
                    css={css`
                      overflow: hidden;
                      text-overflow: ellipsis;
                      max-width: 70%;
                    `}
                  >
                    {label}
                  </EuiHighlight>
                </span>
              </EuiFlexItem>
              {value?.isNewConversationDefault && (
                <EuiFlexItem grow={false} component={'span'}>
                  <EuiToolTip position="right" content={SYSTEM_PROMPT_DEFAULT_NEW_CONVERSATION}>
                    <EuiIcon type={'starFilled'} />
                  </EuiToolTip>
                </EuiFlexItem>
              )}
            </EuiFlexGroup>
          </EuiFlexItem>

          {!value?.isDefault && (
            <EuiFlexItem grow={2} component={'span'}>
              <EuiToolTip position="right" content={i18n.DELETE_SYSTEM_PROMPT}>
                <EuiButtonIcon
                  iconType="cross"
                  aria-label={i18n.DELETE_SYSTEM_PROMPT}
                  color="danger"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onDelete(label);
                  }}
                  css={css`
                    visibility: hidden;
                    .parentFlexGroup:hover & {
                      visibility: visible;
                    }
                  `}
                />
              </EuiToolTip>
            </EuiFlexItem>
          )}
        </EuiFlexGroup>
      );
    };

    return (
      <EuiComboBox
        className={SYSTEM_PROMPT_SELECTOR_CLASSNAME}
        aria-label={i18n.SYSTEM_PROMPT_SELECTOR}
        placeholder={i18n.SYSTEM_PROMPT_SELECTOR}
        customOptionText={`${i18n.CUSTOM_OPTION_TEXT} {searchValue}`}
        singleSelection={{ asPlainText: true }}
        options={options}
        selectedOptions={selectedOptions}
        onChange={onChange}
        onCreateOption={onCreateOption}
        renderOption={renderOption}
        autoFocus
      />
    );
  }
);

SystemPromptSelector.displayName = 'SystemPromptSelector';
