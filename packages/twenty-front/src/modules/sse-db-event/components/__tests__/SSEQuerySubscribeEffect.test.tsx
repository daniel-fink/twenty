import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { render, waitFor } from '@testing-library/react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import { type RecordGqlOperationSignature } from 'twenty-shared/types';

import { SSEQuerySubscribeEffect } from '@/sse-db-event/components/SSEQuerySubscribeEffect';
import { ADD_QUERY_TO_EVENT_STREAM_MUTATION } from '@/sse-db-event/graphql/mutations/AddQueryToEventStreamMutation';
import { REMOVE_QUERY_FROM_EVENT_STREAM_MUTATION } from '@/sse-db-event/graphql/mutations/RemoveQueryFromEventStreamMutation';
import { activeQueryListenersState } from '@/sse-db-event/states/activeQueryListenersState';
import { isDestroyingEventStreamState } from '@/sse-db-event/states/isDestroyingEventStreamState';
import { requiredQueryListenersState } from '@/sse-db-event/states/requiredQueryListenersState';
import { shouldDestroyEventStreamState } from '@/sse-db-event/states/shouldDestroyEventStreamState';
import { sseEventStreamIdState } from '@/sse-db-event/states/sseEventStreamIdState';
import { sseEventStreamReadyState } from '@/sse-db-event/states/sseEventStreamReadyState';

const mockUseMutation = jest.fn();

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

const listener = {
  queryId: 'query-id',
  operationSignature: {} as RecordGqlOperationSignature,
};

const getWrapper =
  (store: ReturnType<typeof createStore>) =>
  ({ children }: { children: ReactNode }) => (
    <JotaiProvider store={store}>{children}</JotaiProvider>
  );

const setupReadyStream = () => {
  const store = createStore();

  store.set(sseEventStreamIdState.atom, 'event-stream-id');
  store.set(sseEventStreamReadyState.atom, true);
  store.set(requiredQueryListenersState.atom, [listener]);
  store.set(activeQueryListenersState.atom, []);

  return store;
};

describe('SSEQuerySubscribeEffect', () => {
  const addQueryToEventStream = jest.fn();
  const removeQueryFromEventStream = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMutation.mockImplementation((mutation) => {
      if (mutation === ADD_QUERY_TO_EVENT_STREAM_MUTATION) {
        return [addQueryToEventStream];
      }

      if (mutation === REMOVE_QUERY_FROM_EVENT_STREAM_MUTATION) {
        return [removeQueryFromEventStream];
      }

      throw new Error('Unexpected mutation');
    });
  });

  it('skips query listener mutation while the current event stream is stale', async () => {
    const store = setupReadyStream();

    store.set(isDestroyingEventStreamState.atom, true);

    render(<SSEQuerySubscribeEffect />, {
      wrapper: getWrapper(store),
    });

    await waitFor(() => {
      expect(addQueryToEventStream).not.toHaveBeenCalled();
    });

    expect(store.get(activeQueryListenersState.atom)).toEqual([]);
  });

  it('clears active listeners and requests stream recreation on handled event stream errors', async () => {
    const store = setupReadyStream();
    const eventStreamError = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Event stream does not exist',
          extensions: {
            code: 'NOT_FOUND',
            subCode: 'EVENT_STREAM_DOES_NOT_EXIST',
          },
        },
      ],
    });

    addQueryToEventStream.mockRejectedValue(eventStreamError);

    render(<SSEQuerySubscribeEffect />, {
      wrapper: getWrapper(store),
    });

    await waitFor(() => {
      expect(store.get(shouldDestroyEventStreamState.atom)).toBe(true);
    });

    expect(store.get(activeQueryListenersState.atom)).toEqual([]);
    expect(addQueryToEventStream).toHaveBeenCalledWith({
      variables: {
        input: {
          eventStreamId: 'event-stream-id',
          queryId: listener.queryId,
          operationSignature: listener.operationSignature,
        },
      },
    });
  });

  it('does not mark listeners active after an unknown mutation failure', async () => {
    const store = setupReadyStream();

    addQueryToEventStream.mockRejectedValue(new Error('Network failed'));

    render(<SSEQuerySubscribeEffect />, {
      wrapper: getWrapper(store),
    });

    await waitFor(() => {
      expect(addQueryToEventStream).toHaveBeenCalled();
    });

    expect(store.get(activeQueryListenersState.atom)).toEqual([]);
    expect(store.get(shouldDestroyEventStreamState.atom)).toBe(false);
  });
});
