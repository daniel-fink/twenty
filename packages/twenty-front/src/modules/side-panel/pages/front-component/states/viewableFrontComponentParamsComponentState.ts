import { SidePanelPageComponentInstanceContext } from '@/side-panel/states/contexts/SidePanelPageComponentInstanceContext';
import { createAtomComponentState } from '@/ui/utilities/state/jotai/utils/createAtomComponentState';

export const viewableFrontComponentParamsComponentState =
  createAtomComponentState<Record<string, string> | null>({
    key: 'side-panel/viewable-front-component-params',
    defaultValue: null,
    componentInstanceContext: SidePanelPageComponentInstanceContext,
  });
