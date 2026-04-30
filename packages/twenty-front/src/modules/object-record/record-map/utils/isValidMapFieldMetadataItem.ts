import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { FieldMetadataType } from '~/generated-metadata/graphql';

export type MapFieldMetadataItem = FieldMetadataItem & {
  type: FieldMetadataType.ADDRESS | FieldMetadataType.GEOMETRY;
};

export const isValidMapFieldMetadataItem = (
  field: FieldMetadataItem,
): field is MapFieldMetadataItem => {
  const isAddressField = field.type === FieldMetadataType.ADDRESS;
  const isPointGeometryField =
    field.type === FieldMetadataType.GEOMETRY &&
    field.settings?.geometryType === 'POINT' &&
    field.settings?.srid === 4326 &&
    field.settings?.isGeography === false;

  return field.isActive === true && (isAddressField || isPointGeometryField);
};
