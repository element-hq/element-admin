// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useMemo } from "react";
import type { MessageDescriptor } from "react-intl";

type FilterDefinition<
  State extends Record<string, unknown>,
  Key,
> = Key extends keyof State
  ? {
      key: Key;
      value: State[Key];
      message: MessageDescriptor;
    }
  : never;

interface FilterState<State extends Record<string, unknown>> {
  enabled: boolean;
  key: string;
  message: MessageDescriptor;
  enabledState: State;
  disabledState: State;
  toggledState: State;
}

interface Filters<State extends Record<string, unknown>> {
  all: FilterState<State>[];
  active: FilterState<State>[];
  clearedState: State;
}

export const useFilters = <
  State extends Record<string, unknown>,
  D extends readonly FilterDefinition<State, keyof State>[],
>(
  state: State,
  definitions: D,
): Filters<State> =>
  useMemo(() => {
    const clearedState = { ...state };
    for (const definition of definitions) {
      // This is a little bit of a hack, since State could in theory not allow
      // undefined, but Object.assign is flexible enough to allow us to do that
      // with no type error
      Object.assign(clearedState, { [definition.key]: undefined });
    }

    const all = definitions.map((definition) => {
      const key = `${String(definition.key)}-${String(definition.value)}`;

      const enabledState = { ...state, [definition.key]: definition.value };
      const disabledState = { ...state, [definition.key]: undefined };
      const enabled = state[definition.key] === definition.value;
      const toggledState = enabled ? disabledState : enabledState;

      return {
        enabled,
        key,
        message: definition.message,
        enabledState,
        disabledState,
        toggledState,
      };
    });

    const active = all.filter((filter) => filter.enabled);

    return {
      all,
      active,
      clearedState,
    };
  }, [definitions, state]);
