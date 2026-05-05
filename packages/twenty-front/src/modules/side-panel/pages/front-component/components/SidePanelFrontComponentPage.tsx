import { Suspense, lazy } from 'react';

import { viewableFrontComponentIdComponentState } from '@/side-panel/pages/front-component/states/viewableFrontComponentIdComponentState';
import { viewableFrontComponentParamsComponentState } from '@/side-panel/pages/front-component/states/viewableFrontComponentParamsComponentState';
import { viewableFrontComponentRecordContextComponentState } from '@/side-panel/pages/front-component/states/viewableFrontComponentRecordContextComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { isDefined } from 'twenty-shared/utils';

const FrontComponentRenderer = lazy(() =>
  import('@/front-components/components/FrontComponentRenderer').then(
    (module) => ({ default: module.FrontComponentRenderer }),
  ),
);

export const SidePanelFrontComponentPage = () => {
  const viewableFrontComponentId = useAtomComponentStateValue(
    viewableFrontComponentIdComponentState,
  );

  const viewableFrontComponentRecordContext = useAtomComponentStateValue(
    viewableFrontComponentRecordContextComponentState,
  );
  const viewableFrontComponentParams = useAtomComponentStateValue(
    viewableFrontComponentParamsComponentState,
  );

  if (!isDefined(viewableFrontComponentId)) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <FrontComponentRenderer
        frontComponentId={viewableFrontComponentId}
        params={viewableFrontComponentParams ?? undefined}
        recordId={viewableFrontComponentRecordContext?.recordId}
      />
    </Suspense>
  );
};
