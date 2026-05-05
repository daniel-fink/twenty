import { useIsPageLayoutInEditMode } from '@/page-layout/hooks/useIsPageLayoutInEditMode';
import { usePageLayoutContentContext } from '@/page-layout/contexts/PageLayoutContentContext';
import { PAGE_LAYOUT_GRID_MARGIN } from '@/page-layout/constants/PageLayoutGridMargin';
import { PAGE_LAYOUT_GRID_ROW_HEIGHT } from '@/page-layout/constants/PageLayoutGridRowHeight';
import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { PageLayoutWidgetNoDataDisplay } from '@/page-layout/widgets/components/PageLayoutWidgetNoDataDisplay';
import { WidgetSkeletonLoader } from '@/page-layout/widgets/components/WidgetSkeletonLoader';
import { useLayoutRenderingContext } from '@/ui/layout/contexts/LayoutRenderingContext';
import { styled } from '@linaria/react';
import { useState } from 'react';
import { getSafeUrl, isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import {
  PageLayoutTabLayoutMode,
  PageLayoutType,
} from '~/generated-metadata/graphql';

const StyledContainer = styled.div<{
  $isEditMode: boolean;
  $minHeightPx?: number;
}>`
  background: ${themeCssVariables.background.primary};
  border-radius: ${themeCssVariables.border.radius.md};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: ${({ $minHeightPx }) =>
    $minHeightPx === undefined ? '0' : `${$minHeightPx}px`};
  overflow: hidden;
  pointer-events: ${({ $isEditMode }) => ($isEditMode ? 'none' : 'auto')};
  position: relative;
  width: 100%;
`;

const StyledIframe = styled.iframe<{ $isEditMode: boolean }>`
  border: none;
  flex: 1;
  height: 100%;
  pointer-events: ${({ $isEditMode }) => ($isEditMode ? 'none' : 'auto')};
  width: 100%;
`;

const StyledLoadingContainer = styled.div`
  background: ${themeCssVariables.background.primary};
  bottom: 0;
  left: 0;
  padding-left: ${themeCssVariables.spacing[2]};
  padding-top: ${themeCssVariables.spacing[2]};
  pointer-events: none;
  position: absolute;
  right: 0;
  top: 0;
  z-index: 1;
`;

const StyledErrorContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
  padding: ${themeCssVariables.spacing[4]};
  text-align: center;
`;

export type IframeWidgetProps = {
  widget: PageLayoutWidget;
};

const getRecordAwareIframeUrl = ({
  layoutType,
  recordId,
  url,
}: {
  layoutType: PageLayoutType;
  recordId?: string;
  url: string;
}) => {
  if (layoutType !== PageLayoutType.RECORD_PAGE || !isDefined(recordId)) {
    return url;
  }

  try {
    const parsedUrl = new URL(url);

    if (!parsedUrl.searchParams.has('recordId')) {
      parsedUrl.searchParams.set('recordId', recordId);
    }

    return parsedUrl.toString();
  } catch {
    return url;
  }
};

export const IframeWidget = ({ widget }: IframeWidgetProps) => {
  const isPageLayoutInEditMode = useIsPageLayoutInEditMode();
  const { layoutType, targetRecordIdentifier } = useLayoutRenderingContext();
  const { layoutMode } = usePageLayoutContentContext();

  const configuration = widget.configuration;

  if (!isDefined(configuration) || !('url' in configuration)) {
    throw new Error(`Invalid configuration for widget ${widget.id}`);
  }

  const url = configuration.url;
  const title = widget.title;

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const safeUrl = isDefined(url) ? getSafeUrl(url) : undefined;
  const recordAwareSafeUrl = isDefined(safeUrl)
    ? getRecordAwareIframeUrl({
        layoutType,
        recordId: targetRecordIdentifier?.id,
        url: safeUrl,
      })
    : undefined;
  const isHttpUrl =
    isDefined(recordAwareSafeUrl) && /^https?:\/\//i.test(recordAwareSafeUrl);
  const verticalListMinHeightPx =
    layoutMode === PageLayoutTabLayoutMode.VERTICAL_LIST
      ? widget.gridPosition.rowSpan * PAGE_LAYOUT_GRID_ROW_HEIGHT +
        Math.max(0, widget.gridPosition.rowSpan - 1) * PAGE_LAYOUT_GRID_MARGIN
      : undefined;

  if (hasError || !isHttpUrl) {
    return (
      <StyledContainer
        $isEditMode={isPageLayoutInEditMode}
        $minHeightPx={verticalListMinHeightPx}
      >
        <StyledErrorContainer>
          <PageLayoutWidgetNoDataDisplay />
        </StyledErrorContainer>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer
      $isEditMode={isPageLayoutInEditMode}
      $minHeightPx={verticalListMinHeightPx}
    >
      {isLoading && (
        <StyledLoadingContainer>
          <WidgetSkeletonLoader />
        </StyledLoadingContainer>
      )}
      <StyledIframe
        $isEditMode={isPageLayoutInEditMode}
        src={recordAwareSafeUrl}
        title={title}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
        allow="encrypted-media"
        allowFullScreen
      />
    </StyledContainer>
  );
};
