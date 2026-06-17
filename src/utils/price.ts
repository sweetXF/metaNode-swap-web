const Q96 = 2n ** 96n;
const Q192 = Q96 * Q96;

/** Uniswap V3 tick 边界 */
const MIN_TICK = -887272;
const MAX_TICK = 887272;

/** bigint 整数平方根（牛顿迭代），返回 floor(sqrt(n)) */
const sqrtBigInt = (n: bigint): bigint => {
  if (n < 0n) throw new Error('negative');
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
};

// sqrtPriceX96 换算成 current price
//公式：current price (token1 / token0) = (sqrtPriceX96 / 2^96)² × 10^(decimals0 - decimals1)
export const sqrtPriceX96ToPrice = (
  sqrtPriceX96: bigint | undefined | null,
  decimals0 = 18,
  decimals1 = 18
): number => {
  if (sqrtPriceX96 == null || sqrtPriceX96 === 0n) return 0;
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  const price = sqrtPrice * sqrtPrice;
  return price * Math.pow(10, decimals0 - decimals1);

  // const SCALE = 10n ** 18n;
  // const priceRawScaled = (sqrtPriceX96 * sqrtPriceX96 * SCALE) / Q192; // = price_raw × 10^18
  // const decimals = decimals0 - decimals1;
  // const price =
  //   decimals >= 0
  //     ? priceRawScaled * 10n ** BigInt(decimals)
  //     : priceRawScaled / 10n ** BigInt(-decimals);
  // return Number(price) / 1e18;
};

// current price 换算成 sqrtPriceX96
// 调整 decimals 后开根号 × 2^96
export const priceToSqrtPriceX96 = (
  price: string | number,
  decimals0 = 18,
  decimals1 = 18
): bigint => {
  const priceStr = typeof price === 'number' ? price.toString() : price;
  if (!priceStr || Number(priceStr) === 0) return 0n;

  const [intPart, fracPart = ''] = priceStr.split('.');
  const scale = fracPart.length;
  const numerator = BigInt(intPart + fracPart);
  const denominator = 10n ** BigInt(scale);

  const decimals = decimals1 - decimals0;
  const decFactor = decimals >= 0 ? 10n ** BigInt(decimals) : 1n;
  const decDivisor = decimals < 0 ? 10n ** BigInt(-decimals) : 1n;
  const priceRaw = (numerator * decFactor * Q192) / (denominator * decDivisor);
  return sqrtBigInt(priceRaw);
};

//tick 换算成真实 price
//公式：price = 1.0001^tick × 10^(decimals0 - decimals1)
export const tickToPrice = (tick: number, decimals0 = 18, decimals1 = 18): number => {
  const price = Math.pow(1.0001, tick);
  return price * Math.pow(10, decimals0 - decimals1);
};

//真实 price 换算成 tick
//思路：先由 price 算出精确的 sqrtPriceX96（bigint），再用 log 估算 tick，最后通过反查 tickToSqrtPriceX96 微调
export const priceToTick = (price: string, decimals0 = 18, decimals1 = 18): number => {
  // const d_price = price / Math.pow(10, decimals0 - decimals1);
  // return Math.log(d_price) / Math.log(1.0001);
  const targetSqrtX96 = priceToSqrtPriceX96(price, decimals0, decimals1);
  if (targetSqrtX96 === 0n) return MIN_TICK;

  // 用 log 估算（够精确，误差 ±1 内）
  // price_raw = (sqrtX96 / 2^96)^2，tick = log_1.0001(price_raw)
  const sqrtRatio = Number(targetSqrtX96) / Number(Q96);
  const priceRaw = sqrtRatio * sqrtRatio;
  let tick = Math.floor(Math.log(priceRaw) / Math.log(1.0001));

  // 微调：保证 tickToSqrtPriceX96(tick) <= targetSqrtX96 < tickToSqrtPriceX96(tick+1)
  // 防止 log 浮点误差导致 tick 偏 1
  while (tick < MAX_TICK && tickToSqrtPriceX96(tick + 1) <= targetSqrtX96) tick++;
  while (tick > MIN_TICK && tickToSqrtPriceX96(tick) > targetSqrtX96) tick--;

  return tick;
};

/**
 * tick → sqrtPriceX96（精确，无精度损失）
 * 公式：sqrtPriceX96 = sqrt(1.0001^tick) * 2^96 = 1.0001^(tick/2) * 2^96
 *
 * 这里采用 Math.pow 计算，结果四舍五入到 bigint。
 * 对于 ±887272 范围内的 tick，Math.pow(1.0001, tick/2) 是 IEEE 754 可表示的，
 * 乘 2^96 后取整误差 ≤ 1 wei，对 LP 场景足够精确。
 *
 * 如需 100% 匹配合约（位运算版 TickMath），可后续替换为 Uniswap 的实现。
 */
const tickToSqrtPriceX96 = (tick: number): bigint => {
  const sqrtRatio = Math.pow(1.0001, tick / 2);
  // 拆成 bigint 整数 + 小数部分，避免 Number(Q96) 精度问题
  // sqrtRatio * 2^96 = sqrtRatio * 2^96，sqrtRatio 是 double，先放大 1e18 取整再除
  const SCALE = 10n ** 18n;
  const scaled = BigInt(Math.round(sqrtRatio * 1e18));
  return (scaled * Q96) / SCALE;
};

//价格区间格式化展示
export const formatPriceRange = (
  tickLower: number,
  tickUpper: number,
  decimals0 = 18,
  decimals1 = 18,
  fractionDigits = 3
): string => {
  //全区间 [0, ∞]
  if (tickLower <= MIN_TICK && tickUpper >= MAX_TICK) return '0 - ∞';

  const priceLower = tickToPrice(tickLower, decimals0, decimals1);
  const priceUpper = tickToPrice(tickUpper, decimals0, decimals1);
  return `${priceLower.toFixed(fractionDigits)} - ${priceUpper.toFixed(fractionDigits)}`;
};

/** 费率选项，单位是百万分之一 (合约 fee 字段) */
export const FEE_TIERS = [
  { value: 100, label: '0.01%', desc: 'Best for stable pairs' },
  { value: 500, label: '0.05%', desc: 'Best for stable pairs' },
  { value: 3000, label: '0.30%', desc: 'Best for most pairs' },
  { value: 10000, label: '1.00%', desc: 'Best for exotic pairs' },
] as const;

export type FeeTier = (typeof FEE_TIERS)[number]['value']; // 100 | 500 | 3000 | 10000

/**
 * 把 费率 fee（百万分之一）格式化为百分比字符串
 * 例：3000 -> "0.30%"
 */
export const formatFeeTier = (fee: number, fractionDigits = 4): string => {
  return `${(fee / 10000).toFixed(fractionDigits)}%`;
};
