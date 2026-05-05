import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';

import { objectMetadataItemsSelector } from '@/object-metadata/states/objectMetadataItemsSelector';
import { isValidMapFieldMetadataItem } from '@/object-record/record-map/utils/isValidMapFieldMetadataItem';
import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { viewObjectMetadataIdComponentState } from '@/views/states/viewObjectMetadataIdComponentState';
import { FieldMetadataType, SettingsPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

export const useGetAvailableFieldsForMap = () => {
  const viewObjectMetadataId = useAtomComponentStateValue(
    viewObjectMetadataIdComponentState,
  );
  const objectMetadataItems = useAtomStateValue(objectMetadataItemsSelector);
  const setNavigationMemorizedUrl = useSetAtomState(
    navigationMemorizedUrlState,
  );
  const location = useLocation();

  const objectMetadataItem = objectMetadataItems.find(
    (objectMetadata) => objectMetadata.id === viewObjectMetadataId,
  );

  const availableFieldsForMap =
    objectMetadataItem?.readableFields.filter(isValidMapFieldMetadataItem) ??
    [];

  const navigate = useNavigateSettings();

  const navigateToGeometryFieldSettings = useCallback(() => {
    setNavigationMemorizedUrl(location.pathname + location.search);

    if (isDefined(objectMetadataItem?.namePlural)) {
      navigate(
        SettingsPath.ObjectNewFieldConfigure,
        {
          objectNamePlural: objectMetadataItem.namePlural,
        },
        {
          fieldType: FieldMetadataType.GEOMETRY,
        },
      );
    } else {
      navigate(SettingsPath.Objects);
    }
  }, [
    setNavigationMemorizedUrl,
    location.pathname,
    location.search,
    objectMetadataItem,
    navigate,
  ]);

  return {
    availableFieldsForMap,
    navigateToGeometryFieldSettings,
  };
};
