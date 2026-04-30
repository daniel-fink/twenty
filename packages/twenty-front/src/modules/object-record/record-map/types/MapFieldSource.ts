import { type FieldMetadataType } from '~/generated-metadata/graphql';

export type MapFieldSource = {
  fieldMetadataId: string;
  fieldName: string;
  type: FieldMetadataType.ADDRESS;
};
