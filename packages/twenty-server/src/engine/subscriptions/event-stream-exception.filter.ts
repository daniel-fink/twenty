import { Catch } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';

import { assertUnreachable } from 'twenty-shared/utils';

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import {
  EventStreamException,
  EventStreamExceptionCode,
} from 'src/engine/subscriptions/event-stream.exception';

@Catch(EventStreamException)
export class EventStreamExceptionFilter implements GqlExceptionFilter {
  catch(exception: EventStreamException) {
    switch (exception.code) {
      case EventStreamExceptionCode.EVENT_STREAM_ALREADY_EXISTS:
        throw new ConflictError(exception);
      case EventStreamExceptionCode.EVENT_STREAM_DOES_NOT_EXIST:
        throw new NotFoundError(exception);
      case EventStreamExceptionCode.NOT_AUTHORIZED:
        throw new ForbiddenError(exception);
      default: {
        throw assertUnreachable(exception.code);
      }
    }
  }
}
