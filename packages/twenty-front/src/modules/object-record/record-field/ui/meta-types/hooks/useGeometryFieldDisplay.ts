import { useContext } from 'react';

import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { type FieldGeometryValue } from '@/object-record/record-field/ui/types/FieldMetadata';
import { useRecordFieldValue } from '@/object-record/record-store/hooks/useRecordFieldValue';

const formatCoordinate = (value: number) => value.toFixed(6);

export const useGeometryFieldDisplay = () => {
  const { recordId, fieldDefinition } = useContext(FieldContext);

  const fieldName = fieldDefinition.metadata.fieldName;
  const fieldValue = useRecordFieldValue<FieldGeometryValue | undefined>(
    recordId,
    fieldName,
    fieldDefinition,
  );

  const formattedFieldValue =
    fieldValue?.type === 'Point'
      ? `${formatCoordinate(fieldValue.coordinates[1])}, ${formatCoordinate(
          fieldValue.coordinates[0],
        )}`
      : '';

  return {
    fieldValue: formattedFieldValue,
  };
};
