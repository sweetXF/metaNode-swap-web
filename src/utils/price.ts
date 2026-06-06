const Q96 = 2n ** 96n;

// sqrtPriceX96 换算成 current price
//公式：current price (token1 / token0) = (sqrtPriceX96 / 2^96)² × 10^(decimals0 - decimals1)
export const sqrtPriceX96ToPrice = (sqrtPriceX96:bigint,decimals0=18,decimals1=18):number => {
    if (sqrtPriceX96===0n) return 0;
    const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
    const price = sqrtPrice * sqrtPrice;
    // 调整 decimals
    return price * Math.pow(10, decimals0 - decimals1);
}

// current price 换算成 sqrtPriceX96
// 调整 decimals 后开根号 × 2^96
export const priceToSqrtPriceX96 = (price:number,decimals0=18,decimals1=18):bigint => {
    if (price===0) return 0n;
    const d_price = price / Math.pow(10, decimals0 - decimals1);
    const sqrtPrice = Math.sqrt(d_price);
    return BigInt(Math.round(sqrtPrice * Number(Q96)));
}


//tick 换算成真实 price
//公式：price = 1.0001^tick × 10^(decimals0 - decimals1)
export const tickToPrice = (tick:number,decimals0=18,decimals1=18):number => {
    const price=Math.pow(1.0001,tick);
      return price * Math.pow(10, decimals0 - decimals1);
  }

  //真实 price 换算成 tick
  export const priceToTick = (price:number,decimals0=18,decimals1=18):number => {
    const d_price = price / Math.pow(10, decimals0 - decimals1);
    return Math.log(d_price) / Math.log(1.0001);
  }

  //价格区间格式化展示
export const formatPriceRange = (tickLower:number,tickUpper:number,decimals0=18,decimals1=18,fractionDigits=3):string => {
    //全区间 [0, ∞]
    if (tickLower<=-887220 && tickUpper>=887220) return '0 - ∞';

    const priceLower = tickToPrice(tickLower,decimals0,decimals1);
    const priceUpper = tickToPrice(tickUpper,decimals0,decimals1);
    return `${priceLower.toFixed(fractionDigits)} - ${priceUpper.toFixed(fractionDigits)}`;
}

/** 费率选项，单位是百万分之一 (合约 fee 字段) */
export const FEE_TIERS = [
    { value: 100,   label: "0.01%", desc: "Best for stable pairs" },
    { value: 500,   label: "0.05%", desc: "Best for stable pairs" },
    { value: 3000,  label: "0.30%", desc: "Best for most pairs" },
    { value: 10000, label: "1.00%", desc: "Best for exotic pairs" },
  ] as const;

  export type FeeTier = (typeof FEE_TIERS)[number]['value']; // 100 | 500 | 3000 | 10000

/**
 * 把 费率 fee（百万分之一）格式化为百分比字符串
 * 例：3000 -> "0.30%"
 */
export const formatFeeTier = (fee:number,fractionDigits=2):string => {
    return `${(fee / 10000).toFixed(fractionDigits)}%`;
}