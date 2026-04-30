import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const recordIndexMapFieldMetadataIdState = createAtomState<
  string | null
>({
  key: 'recordIndexMapFieldMetadataIdState',
  defaultValue: null,
});
