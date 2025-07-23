import { makePortfolioSteps, YieldProtocol, EVMChain } from './ymax-client';
import {
  validateRequiredBrands,
  showBrandNotAvailableAlert,
  bigintReplacer,
} from './utils';
import { BRAND_NAMES } from './constants';
/**
 * Handle offer updates with proper logging and alerts
 */
export const createOfferUpdateHandler = (offerType: string) => {
  return (update: { status: string; data?: unknown }) => {
    console.log(`${offerType} offer update:`, update);

    const offerDetails = JSON.stringify(update, bigintReplacer, 2);

    switch (update.status) {
      case 'error':
        console.error(`${offerType} error:`, update.data);
        alert(`${offerType} error: ${offerDetails}`);
        break;
      case 'accepted':
        console.log(`${offerType} accepted:`, update.data);
        alert(`${offerType} accepted: ${offerDetails}`);
        break;
      case 'refunded':
        console.log(`${offerType} rejected:`, update.data);
        alert(`${offerType} rejected: ${offerDetails}`);
        break;
    }
  };
};

/**
 * Validate and get brands for making an offer
 */
export const validateOfferBrands = (purses: Array<Purse> | undefined) => {
  const requiredBrands = [BRAND_NAMES.USDC, BRAND_NAMES.POC26, BRAND_NAMES.BLD];
  const validation = validateRequiredBrands(purses, requiredBrands);

  if (!validation.isValid && validation.missingBrand) {
    showBrandNotAvailableAlert(validation.missingBrand);
    return null;
  }

  // Get all brands
  const getBrand = (brandName: string) => {
    const purse = purses?.find(
      p => p.brandPetname?.toLowerCase() === brandName.toLowerCase(),
    );
    return purse?.brand;
  };

  return {
    usdcBrand: getBrand(BRAND_NAMES.USDC),
    poc26Brand: getBrand(BRAND_NAMES.POC26),
    bldBrand: getBrand(BRAND_NAMES.BLD),
  };
};

/**
 * Create portfolio steps with proper error handling
 */
export const createPortfolioSteps = (
  yProtocol: YieldProtocol,
  giveValue: bigint,
  usdcBrand: any,
  bldBrand: any,
  bldFeeAmount: bigint,
) => {
  const position: Record<string, { brand: any; value: bigint }> = {};
  position[yProtocol] = {
    brand: usdcBrand,
    value: giveValue,
  };

  return makePortfolioSteps(position, {
    evm: 'Avalanche' as EVMChain,
    feeBrand: bldBrand,
    feeBasisPoints: bldFeeAmount,
    detail:
      yProtocol === 'USDN' ? { usdnOut: (giveValue * 99n) / 100n } : undefined,
  });
};
