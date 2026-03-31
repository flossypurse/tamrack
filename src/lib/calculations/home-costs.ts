import {
  LAND_TITLES,
  MORTGAGE_REGISTRATION,
  CMHC_PREMIUMS,
  TYPICAL_COSTS,
  GST_RATE,
  GST_NEW_HOUSING_REBATE,
  GST_FIRST_TIME_BUYER_REBATE,
} from "@/lib/constants/tools/home-costs";

export interface HomeCostInputs {
  purchasePrice: number;
  downPaymentPercent: number;
  isNewConstruction: boolean;
  isFirstTimeBuyer: boolean;
  includeInspection: boolean;
  includeTitleInsurance: boolean;
  lawyerFees: number;
  propertyTaxAdjustment: number;
  movingCosts: number;
}

export interface HomeCostResult {
  purchasePrice: number;
  downPayment: number;
  mortgageAmount: number;
  ltv: number;

  // Mandatory costs
  landTitlesFee: number;
  mortgageRegistrationFee: number;
  cmhcInsurance: number;
  cmhcInsuranceRequired: boolean;
  lawyerFees: number;

  // Optional costs
  homeInspection: number;
  titleInsurance: number;
  propertyTaxAdjustment: number;
  movingCosts: number;

  // GST (new construction only)
  gstAmount: number;
  gstStandardRebate: number;
  gstFirstTimeBuyerRebate: number;
  gstNet: number;

  // Totals
  totalClosingCosts: number;
  totalCashNeeded: number;
}

export function calculateHomeCosts(inputs: HomeCostInputs): HomeCostResult {
  const {
    purchasePrice,
    downPaymentPercent,
    isNewConstruction,
    isFirstTimeBuyer,
    includeInspection,
    includeTitleInsurance,
    lawyerFees,
    propertyTaxAdjustment,
    movingCosts,
  } = inputs;

  const downPayment = purchasePrice * (downPaymentPercent / 100);
  const mortgageAmount = purchasePrice - downPayment;
  const ltv = mortgageAmount / purchasePrice;

  // Land titles registration fee
  const landTitlesFee =
    LAND_TITLES.baseFee +
    Math.ceil(purchasePrice / LAND_TITLES.unitSize) * LAND_TITLES.perUnit;

  // Mortgage registration fee
  const mortgageRegistrationFee =
    mortgageAmount > 0
      ? MORTGAGE_REGISTRATION.baseFee +
        Math.ceil(mortgageAmount / MORTGAGE_REGISTRATION.unitSize) *
          MORTGAGE_REGISTRATION.perUnit
      : 0;

  // CMHC insurance (required if down payment < 20%)
  const cmhcInsuranceRequired = downPaymentPercent < 20;
  let cmhcInsurance = 0;
  if (cmhcInsuranceRequired) {
    const tier = CMHC_PREMIUMS.find((t) => ltv <= t.maxLTV);
    if (tier) {
      cmhcInsurance = mortgageAmount * tier.rate;
    }
  }

  // Optional costs
  const homeInspection = includeInspection
    ? TYPICAL_COSTS.homeInspection.default
    : 0;
  const titleInsurance = includeTitleInsurance
    ? TYPICAL_COSTS.titleInsurance.default
    : 0;

  // GST (new construction only)
  let gstAmount = 0;
  let gstStandardRebate = 0;
  let gstFirstTimeBuyerRebate = 0;

  if (isNewConstruction) {
    gstAmount = purchasePrice * GST_RATE;

    // Standard new housing rebate
    if (purchasePrice <= GST_NEW_HOUSING_REBATE.fullRebateThreshold) {
      gstStandardRebate = Math.min(
        gstAmount * GST_NEW_HOUSING_REBATE.rate,
        GST_NEW_HOUSING_REBATE.maxRebate
      );
    } else if (purchasePrice < GST_NEW_HOUSING_REBATE.noRebateThreshold) {
      const factor =
        (GST_NEW_HOUSING_REBATE.noRebateThreshold - purchasePrice) /
        (GST_NEW_HOUSING_REBATE.noRebateThreshold -
          GST_NEW_HOUSING_REBATE.fullRebateThreshold);
      gstStandardRebate = Math.min(
        gstAmount * GST_NEW_HOUSING_REBATE.rate * factor,
        GST_NEW_HOUSING_REBATE.maxRebate
      );
    }

    // First-time buyer rebate (2026+)
    if (isFirstTimeBuyer) {
      if (
        purchasePrice <= GST_FIRST_TIME_BUYER_REBATE.fullRebateThreshold
      ) {
        gstFirstTimeBuyerRebate = Math.min(
          gstAmount,
          GST_FIRST_TIME_BUYER_REBATE.maxRebate
        );
      } else if (
        purchasePrice < GST_FIRST_TIME_BUYER_REBATE.noRebateThreshold
      ) {
        const factor =
          (GST_FIRST_TIME_BUYER_REBATE.noRebateThreshold - purchasePrice) /
          (GST_FIRST_TIME_BUYER_REBATE.noRebateThreshold -
            GST_FIRST_TIME_BUYER_REBATE.fullRebateThreshold);
        gstFirstTimeBuyerRebate = Math.min(
          gstAmount * factor,
          GST_FIRST_TIME_BUYER_REBATE.maxRebate
        );
      }
    }
  }

  // Use the larger of the two rebates, not both
  const bestRebate = Math.max(gstStandardRebate, gstFirstTimeBuyerRebate);
  const gstNet = Math.max(0, gstAmount - bestRebate);

  // Totals
  const totalClosingCosts =
    landTitlesFee +
    mortgageRegistrationFee +
    cmhcInsurance +
    lawyerFees +
    homeInspection +
    titleInsurance +
    propertyTaxAdjustment +
    movingCosts +
    gstNet;

  const totalCashNeeded = downPayment + totalClosingCosts;

  return {
    purchasePrice,
    downPayment,
    mortgageAmount,
    ltv,
    landTitlesFee,
    mortgageRegistrationFee,
    cmhcInsurance,
    cmhcInsuranceRequired,
    lawyerFees,
    homeInspection,
    titleInsurance,
    propertyTaxAdjustment,
    movingCosts,
    gstAmount,
    gstStandardRebate,
    gstFirstTimeBuyerRebate: bestRebate === gstFirstTimeBuyerRebate ? gstFirstTimeBuyerRebate : 0,
    gstNet,
    totalClosingCosts,
    totalCashNeeded,
  };
}
