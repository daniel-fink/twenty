import { FieldMetadataType } from '~/generated-metadata/graphql';

export type MapFieldSource = {
  fieldMetadataId: string;
  fieldName: string;
  fieldLabel: string;
  type: FieldMetadataType.ADDRESS;
};
