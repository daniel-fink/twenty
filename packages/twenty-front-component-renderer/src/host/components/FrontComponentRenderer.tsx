import { FrontComponentErrorEffect } from '@/remote/components/FrontComponentErrorEffect';
import { FrontComponentInitializeHostCommunicationApiEffect } from '@/remote/components/FrontComponentInitializeHostCommunicationApiEffect';
import { FrontComponentUpdateContextEffect } from '@/remote/components/FrontComponentUpdateContextEffect';
import { FrontComponentUpdateHostCommunicationApiEffect } from '@/remote/components/FrontComponentUpdateHostCommunicationApiEffect';
import { type FrontComponentHostCommunicationApi } from '@/types/FrontComponentHostCommunicationApi';
import { type SdkClientUrls } from '@/types/HostToWorkerRenderContext';
import { type WorkerExports } from '@/types/WorkerExports';
import { type FrontComponentExecutionContext } from 'twenty-sdk/front-component';
import { type ThreadWebWorker } from '@quilted/threads';
import {
  type RemoteReceiver,
  RemoteRootRenderer,
} from '@remote-dom/react/host';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isDefined } from 'twenty-shared/utils';

import { ThemeProvider } from 'twenty-ui/theme-constants';
import { FrontComponentWorkerEffect } from '../../remote/components/FrontComponentWorkerEffect';
import { componentRegistry } from '../generated/host-component-registry';

const FRONT_COMPONENT_IFRAME_HOST_API_MESSAGE_TYPE =
  'twenty-front-component-host-api';

type OpenFrontComponentInSidePanelPayload = Parameters<
  FrontComponentHostCommunicationApi['openFrontComponentInSidePanel']
>[0];

type FrontComponentIframeHostApiMessage = {
  action: 'openFrontComponentInSidePanel';
  payload: OpenFrontComponentInSidePanelPayload;
  type: typeof FRONT_COMPONENT_IFRAME_HOST_API_MESSAGE_TYPE;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) &&
  Object.values(value).every((entry) => typeof entry === 'string');

const isOpenFrontComponentInSidePanelPayload = (
  value: unknown,
): value is OpenFrontComponentInSidePanelPayload => {
  if (!isRecord(value) || typeof value.pageTitle !== 'string') {
    return false;
  }

  return (
    (value.applicationUniversalIdentifier === undefined ||
      typeof value.applicationUniversalIdentifier === 'string') &&
    (value.frontComponentId === undefined ||
      typeof value.frontComponentId === 'string') &&
    (value.frontComponentUniversalIdentifier === undefined ||
      typeof value.frontComponentUniversalIdentifier === 'string') &&
    (value.pageIcon === undefined || typeof value.pageIcon === 'string') &&
    (value.params === undefined || isStringRecord(value.params)) &&
    (value.resetNavigationStack === undefined ||
      typeof value.resetNavigationStack === 'boolean')
  );
};

const isFrontComponentIframeHostApiMessage = (
  value: unknown,
): value is FrontComponentIframeHostApiMessage =>
  isRecord(value) &&
  value.type === FRONT_COMPONENT_IFRAME_HOST_API_MESSAGE_TYPE &&
  value.action === 'openFrontComponentInSidePanel' &&
  isOpenFrontComponentInSidePanelPayload(value.payload);

type FrontComponentContentProps = {
  componentUrl: string;
  applicationAccessToken?: string;
  apiUrl?: string;
  sdkClientUrls?: SdkClientUrls;
  applicationVariables?: Record<string, string>;
  executionContext: FrontComponentExecutionContext;
  frontComponentHostCommunicationApi: FrontComponentHostCommunicationApi;
  onError: (error?: Error) => void;
  colorScheme: 'light' | 'dark';
};

export const FrontComponentRenderer = ({
  componentUrl,
  applicationAccessToken,
  apiUrl,
  sdkClientUrls,
  applicationVariables,
  executionContext,
  frontComponentHostCommunicationApi,
  onError,
  colorScheme,
}: FrontComponentContentProps) => {
  const remoteRootContainerRef = useRef<HTMLDivElement | null>(null);
  const [receiver, setReceiver] = useState<RemoteReceiver | null>(null);
  const [thread, setThread] = useState<ThreadWebWorker<
    WorkerExports,
    FrontComponentHostCommunicationApi
  > | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isExecutionContextInitialized, setIsExecutionContextInitialized] =
    useState(false);

  const MemoizedFrontComponentWorkerEffect = useMemo(() => {
    return (
      <FrontComponentWorkerEffect
        componentUrl={componentUrl}
        applicationAccessToken={applicationAccessToken}
        apiUrl={apiUrl}
        sdkClientUrls={sdkClientUrls}
        applicationVariables={applicationVariables}
        frontComponentId={executionContext.frontComponentId}
        setReceiver={setReceiver}
        setThread={setThread}
        setError={setError}
      />
    );
  }, [
    componentUrl,
    setError,
    setReceiver,
    setThread,
    applicationAccessToken,
    apiUrl,
    sdkClientUrls,
    applicationVariables,
    executionContext.frontComponentId,
  ]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const remoteRootContainer = remoteRootContainerRef.current;

      if (!isDefined(remoteRootContainer) || !isDefined(event.source)) {
        return;
      }

      const isFromDescendantIframe = Array.from(
        remoteRootContainer.querySelectorAll('iframe'),
      ).some((iframe) => iframe.contentWindow === event.source);

      if (
        !isFromDescendantIframe ||
        !isFrontComponentIframeHostApiMessage(event.data)
      ) {
        return;
      }

      frontComponentHostCommunicationApi
        .openFrontComponentInSidePanel(event.data.payload)
        .catch((messageError: Error) => {
          setError(messageError);
        });
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [frontComponentHostCommunicationApi]);

  return (
    <>
      {MemoizedFrontComponentWorkerEffect}

      {isDefined(error) && (
        <>
          <FrontComponentErrorEffect error={error} onError={onError} />
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#991b1b',
              fontFamily: 'monospace',
              fontSize: '13px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '200px',
              overflow: 'auto',
            }}
          >
            <strong>FrontComponent error:</strong> {error.message}
          </div>
        </>
      )}

      {isDefined(thread) && (
        <>
          <FrontComponentUpdateHostCommunicationApiEffect
            thread={thread}
            frontComponentHostCommunicationApi={
              frontComponentHostCommunicationApi
            }
          />
          <FrontComponentInitializeHostCommunicationApiEffect thread={thread} />
          <FrontComponentUpdateContextEffect
            thread={thread}
            executionContext={executionContext}
            onExecutionContextInitialized={() =>
              setIsExecutionContextInitialized(true)
            }
          />
        </>
      )}

      {isDefined(receiver) && isExecutionContextInitialized && (
        <div ref={remoteRootContainerRef} style={{ display: 'contents' }}>
          <ThemeProvider colorScheme={colorScheme}>
            <RemoteRootRenderer
              receiver={receiver}
              components={componentRegistry}
            />
          </ThemeProvider>
        </div>
      )}
    </>
  );
};
