import { formatUnits, parseUnits } from 'viem';

// 短地址展示
export const shortAddress = (address?: string, head = 4, tail = 4) => {
  if (!address) return '-';
  if (address.length <= head + tail) return address;
  return address.slice(0, head) + '...' + address.slice(-tail);
};

//把 bigint（带 decimals）格式化为人类可读字符串
export const formatBigInt = (
  value: bigint | undefined | null,
  decimals = 18,
  fractionDigits = 2
): string => {
  if (value === undefined || value === null) return '-';
  const raw = formatUnits(value, decimals);
  const [intPart, fracPart = ''] = raw.split('.');
  // 截取小数位（不四舍五入,不齐末尾自动补0）
  const fracSlice = fracPart.slice(0, fractionDigits).padEnd(fractionDigits, '0');
  return `${intPart}.${fracSlice}`;
};

export const formatToBigInt = (
  value: string | number | undefined | null,
  decimals = 18
): bigint => {
  if (!value) return 0n;
  const val = typeof value === 'string' ? value : value?.toString();
  const bigIntVal = parseUnits(val, decimals);
  return bigIntVal;
};
