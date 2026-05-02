import { ensureTokenPairIsFresh } from '@/apollo/utils/ensureTokenPairIsFresh';
import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { renewToken } from '@/auth/services/AuthService';
import { type AuthTokenPair } from '~/generated-metadata/graphql';
import { cookieStorage } from '~/utils/cookie-storage';

jest.mock('@/apollo/utils/getTokenPair', () => ({
  getTokenPair: jest.fn(),
}));

jest.mock('@/auth/services/AuthService', () => ({
  renewToken: jest.fn(),
}));

jest.mock('~/utils/cookie-storage', () => ({
  cookieStorage: {
    setItem: jest.fn(),
  },
}));

const mockGetTokenPair = getTokenPair as jest.MockedFunction<
  typeof getTokenPair
>;
const mockRenewToken = renewToken as jest.MockedFunction<typeof renewToken>;
const mockCookieStorage = cookieStorage as jest.Mocked<typeof cookieStorage>;

const buildTokenPair = ({
  accessToken = 'access-token',
  expiresAt,
  refreshToken = 'refresh-token',
}: {
  accessToken?: string;
  expiresAt: string;
  refreshToken?: string;
}): AuthTokenPair => ({
  accessOrWorkspaceAgnosticToken: {
    token: accessToken,
    expiresAt,
  },
  refreshToken: {
    token: refreshToken,
    expiresAt: '2099-01-01T00:00:00.000Z',
  },
});

describe('ensureTokenPairIsFresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the current token pair when the access token is fresh', async () => {
    const tokenPair = buildTokenPair({
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    mockGetTokenPair.mockReturnValue(tokenPair);

    await expect(ensureTokenPairIsFresh()).resolves.toEqual(tokenPair);

    expect(mockRenewToken).not.toHaveBeenCalled();
    expect(mockCookieStorage.setItem).not.toHaveBeenCalled();
  });

  it('should renew and persist the token pair when the access token is expired', async () => {
    const expiredTokenPair = buildTokenPair({
      accessToken: 'expired-access-token',
      expiresAt: '2020-01-01T00:00:00.000Z',
    });
    const renewedTokenPair = buildTokenPair({
      accessToken: 'renewed-access-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
      refreshToken: 'renewed-refresh-token',
    });

    mockGetTokenPair.mockReturnValue(expiredTokenPair);
    mockRenewToken.mockResolvedValue(renewedTokenPair);

    await expect(ensureTokenPairIsFresh()).resolves.toEqual(renewedTokenPair);

    expect(mockRenewToken).toHaveBeenCalledWith(
      expect.stringMatching(/\/metadata$/),
      expiredTokenPair,
    );
    expect(mockCookieStorage.setItem).toHaveBeenCalledWith(
      'tokenPair',
      JSON.stringify(renewedTokenPair),
    );
  });

  it('should force renewal even when the access token is fresh', async () => {
    const tokenPair = buildTokenPair({
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    const renewedTokenPair = buildTokenPair({
      accessToken: 'forced-renewed-access-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
      refreshToken: 'forced-renewed-refresh-token',
    });

    mockGetTokenPair.mockReturnValue(tokenPair);
    mockRenewToken.mockResolvedValue(renewedTokenPair);

    await expect(
      ensureTokenPairIsFresh({ forceRenewal: true }),
    ).resolves.toEqual(renewedTokenPair);

    expect(mockRenewToken).toHaveBeenCalledTimes(1);
  });

  it('should return undefined when token renewal fails', async () => {
    const expiredTokenPair = buildTokenPair({
      expiresAt: '2020-01-01T00:00:00.000Z',
    });

    mockGetTokenPair.mockReturnValue(expiredTokenPair);
    mockRenewToken.mockRejectedValue(new Error('failed to renew'));

    await expect(ensureTokenPairIsFresh()).resolves.toBeUndefined();

    expect(mockCookieStorage.setItem).not.toHaveBeenCalled();
  });
});
