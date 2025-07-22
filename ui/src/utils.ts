import { ERROR_MESSAGES } from './constants';

/**
 * Generic function to get brand from purses by petname
 * XXX: Workaround for mismatching brand board ID in agoricNames.brand
 * XXX: Remove this once the issue is fixed
 */
export const getBrand = (
  purses: Array<Purse> | undefined,
  brandPetname: string,
) => {
  if (!purses) return null;

  const purse = purses.find(
    purse => purse.brandPetname?.toLowerCase() === brandPetname.toLowerCase(),
  );

  return purse?.brand;
};

/**
 * Validate required brands are available
 */
export const validateRequiredBrands = (
  purses: Array<Purse> | undefined,
  requiredBrands: string[],
): { isValid: boolean; missingBrand?: string } => {
  for (const brandName of requiredBrands) {
    const brand = getBrand(purses, brandName);
    if (!brand) {
      return {
        isValid: false,
        missingBrand: brandName,
      };
    }
  }
  return { isValid: true };
};

/**
 * Show alert with brand not available message
 */
export const showBrandNotAvailableAlert = (brandName: string) => {
  alert(
    ERROR_MESSAGES.BRAND_NOT_AVAILABLE.replace(
      '{brandName}',
      brandName.toUpperCase(),
    ),
  );
};

/**
 * Format bigint values for JSON serialization
 */
export const bigintReplacer = (_k: string, v: any) =>
  typeof v === 'bigint' ? `${v}` : v;

/**
 * Handle wallet connection errors
 */
export const handleWalletConnectionError = (err: Error) => {
  switch (err.message) {
    case 'KEPLR_CONNECTION_ERROR_NO_SMART_WALLET':
      alert(ERROR_MESSAGES.NO_SMART_WALLET);
      break;
    default:
      alert(err.message);
  }
};

/**
 * Generate unique offer ID
 */
export const generateOfferId = () => Date.now();
