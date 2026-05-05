import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { FieldMetadataType } from '~/generated-metadata/graphql';

export type MapFieldMetadataItem = FieldMetadataItem & {
  type: FieldMetadataType.GEOMETRY;
};

export const isValidMapFieldMetadataItem = (
  field: FieldMetadataItem,
): field is MapFieldMetadataItem => {
  const isGeometryField =
    field.type === FieldMetadataType.GEOMETRY &&
    field.settings?.srid === 4326 &&
    field.settings?.isGeography === false;

  return field.isActive === true && isGeometryField;
};
