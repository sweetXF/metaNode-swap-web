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


//tick 换算成真实 price
//公式：price = 1.0001^tick × 10^(decimals0 - decimals1)
export const tickToPrice = (tick:number,decimals0=18,decimals1=18):number => {
    const price=Math.pow(1.0001,tick);
      return price * Math.pow(10, decimals0 - decimals1);
  }

  //价格区间格式化展示
export const formatPriceRange = (tickLower:number,tickUpper:number,decimals0=18,decimals1=18,fractionDigits=3):string => {
    //全区间 [0, ∞]
    if (tickLower<=-887220 && tickUpper>=887220) return '0 - ∞';

    const priceLower = tickToPrice(tickLower,decimals0,decimals1);
    const priceUpper = tickToPrice(tickUpper,decimals0,decimals1);
    return `${priceLower.toFixed(fractionDigits)} - ${priceUpper.toFixed(fractionDigits)}`;
}

/**
 * 把 费率 fee（百万分之一）格式化为百分比字符串
 * 例：3000 -> "0.30%"
 */
export const formatFeeTier = (fee:number,fractionDigits=2):string => {
    return `${(fee / 10000).toFixed(fractionDigits)}%`;
}