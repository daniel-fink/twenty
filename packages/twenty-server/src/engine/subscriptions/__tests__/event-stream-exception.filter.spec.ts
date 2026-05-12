import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { EventStreamExceptionFilter } from 'src/engine/subscriptions/event-stream-exception.filter';
import {
  EventStreamException,
  EventStreamExceptionCode,
} from 'src/engine/subscriptions/event-stream.exception';

const catchEventStreamException = (code: EventStreamExceptionCode) => {
  const filter = new EventStreamExceptionFilter();

  try {
    filter.catch(new EventStreamException('Event stream failed', code));
  } catch (error) {
    return error;
  }

  throw new Error('Expected event stream exception filter to throw');
};

describe('EventStreamExceptionFilter', () => {
  it('maps missing streams to not found errors with the event stream sub code', () => {
    const error = catchEventStreamException(
      EventStreamExceptionCode.EVENT_STREAM_DOES_NOT_EXIST,
    );

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).extensions).toMatchObject({
      code: 'NOT_FOUND',
      subCode: EventStreamExceptionCode.EVENT_STREAM_DOES_NOT_EXIST,
    });
  });

  it('maps existing streams to conflict errors with the event stream sub code', () => {
    const error = catchEventStreamException(
      EventStreamExceptionCode.EVENT_STREAM_ALREADY_EXISTS,
    );

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).extensions).toMatchObject({
      code: 'CONFLICT',
      subCode: EventStreamExceptionCode.EVENT_STREAM_ALREADY_EXISTS,
    });
  });

  it('maps unauthorized stream operations to forbidden errors with the event stream sub code', () => {
    const error = catchEventStreamException(
      EventStreamExceptionCode.NOT_AUTHORIZED,
    );

    expect(error).toBeInstanceOf(ForbiddenError);
    expect((error as ForbiddenError).extensions).toMatchObject({
      code: 'FORBIDDEN',
      subCode: EventStreamExceptionCode.NOT_AUTHORIZED,
    });
  });
});
