import { renewToken } from '@/auth/services/AuthService';
import { type AuthTokenPair } from '~/generated-metadata/graphql';
import { cookieStorage } from '~/utils/cookie-storage';
import { isUndefinedOrNull } from '~/utils/isUndefinedOrNull';

import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const TOKEN_RENEWAL_SKEW_MS = 60_000;

let tokenRenewalPromise: Promise<AuthTokenPair | undefined> | null = null;

const isTokenExpiredOrExpiringSoon = (expiresAt: string) => {
  const expiresAtMs = new Date(expiresAt).getTime();

  if (Number.isNaN(expiresAtMs)) {
    return true;
  }

  return expiresAtMs - Date.now() <= TOKEN_RENEWAL_SKEW_MS;
};

const persistTokenPair = (tokenPair: AuthTokenPair) => {
  cookieStorage.setItem('tokenPair', JSON.stringify(tokenPair));

  return tokenPair;
};

export const ensureTokenPairIsFresh = async ({
  forceRenewal = false,
}: {
  forceRenewal?: boolean;
} = {}) => {
  const tokenPair = getTokenPair();

  if (isUndefinedOrNull(tokenPair)) {
    return undefined;
  }

  if (
    !forceRenewal &&
    !isTokenExpiredOrExpiringSoon(
      tokenPair.accessOrWorkspaceAgnosticToken.expiresAt,
    )
  ) {
    return tokenPair;
  }

  if (isUndefinedOrNull(tokenRenewalPromise)) {
    tokenRenewalPromise = renewToken(
      `${REACT_APP_SERVER_BASE_URL}/metadata`,
      tokenPair,
    )
      .then((renewedTokenPair) =>
        isUndefinedOrNull(renewedTokenPair)
          ? undefined
          : persistTokenPair(renewedTokenPair),
      )
      .catch(() => undefined)
      .finally(() => {
        tokenRenewalPromise = null;
      });
  }

  return tokenRenewalPromise;
};

