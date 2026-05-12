import { EventStreamResolver } from 'src/engine/subscriptions/event-stream.resolver';
import {
  EventStreamException,
  EventStreamExceptionCode,
} from 'src/engine/subscriptions/event-stream.exception';
import { type AddQuerySubscriptionInput } from 'src/engine/subscriptions/dtos/add-query-subscription.input';
import { type RemoveQueryFromEventStreamInput } from 'src/engine/subscriptions/dtos/remove-query-subscription.input';
import { type RecordOrMetadataGqlOperationSignature } from 'src/engine/subscriptions/types/event-stream-data.type';

const workspace = { id: 'workspace-id' };
const apiKey = undefined;
const user = undefined;
const userWorkspaceId = 'user-workspace-id';

const input: AddQuerySubscriptionInput & RemoveQueryFromEventStreamInput = {
  eventStreamId: 'event-stream-id',
  queryId: 'query-id',
  operationSignature: {} as RecordOrMetadataGqlOperationSignature,
};

const buildResolver = () => {
  const eventStreamService = {
    getStreamData: jest.fn(),
    isAuthorized: jest.fn(),
    addQuery: jest.fn(),
    removeQuery: jest.fn(),
  };

  const resolver = new EventStreamResolver(
    {} as ConstructorParameters<typeof EventStreamResolver>[0],
    eventStreamService as unknown as ConstructorParameters<
      typeof EventStreamResolver
    >[1],
  );

  return { eventStreamService, resolver };
};

describe('EventStreamResolver', () => {
  it('treats removing a query from a missing event stream as idempotent success', async () => {
    const { eventStreamService, resolver } = buildResolver();

    eventStreamService.getStreamData.mockResolvedValue(undefined);

    await expect(
      resolver.removeQueryFromEventStream(
        input,
        workspace as never,
        user,
        userWorkspaceId,
        apiKey,
      ),
    ).resolves.toBe(true);

    expect(eventStreamService.isAuthorized).not.toHaveBeenCalled();
    expect(eventStreamService.removeQuery).not.toHaveBeenCalled();
  });

  it('keeps adding a query to a missing event stream as a handled stale stream error', async () => {
    const { eventStreamService, resolver } = buildResolver();

    eventStreamService.getStreamData.mockResolvedValue(undefined);

    await expect(
      resolver.addQueryToEventStream(
        input,
        workspace as never,
        user,
        userWorkspaceId,
        apiKey,
      ),
    ).rejects.toMatchObject({
      code: EventStreamExceptionCode.EVENT_STREAM_DOES_NOT_EXIST,
    } satisfies Partial<EventStreamException>);

    expect(eventStreamService.addQuery).not.toHaveBeenCalled();
  });
});
