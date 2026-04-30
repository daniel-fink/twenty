import { useGeometryFieldDisplay } from '@/object-record/record-field/ui/meta-types/hooks/useGeometryFieldDisplay';
import { TextDisplay } from '@/ui/field/display/components/TextDisplay';

export const GeometryFieldDisplay = () => {
  const { fieldValue } = useGeometryFieldDisplay();

  if (fieldValue === '') {
    return null;
  }

  return <TextDisplay text={fieldValue} />;
};
