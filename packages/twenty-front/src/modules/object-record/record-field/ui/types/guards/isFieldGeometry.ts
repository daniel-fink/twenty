import { FieldMetadataType } from '~/generated-metadata/graphql';

import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import {
  type FieldGeometryMetadata,
  type FieldMetadata,
} from '@/object-record/record-field/ui/types/FieldMetadata';

export const isFieldGeometry = (
  field: Pick<FieldDefinition<FieldMetadata>, 'type'>,
): field is FieldDefinition<FieldGeometryMetadata> =>
  field.type === FieldMetadataType.GEOMETRY;
