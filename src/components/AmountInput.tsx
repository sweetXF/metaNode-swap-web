import { useMemo } from 'react';
import { useTokenInfos } from '../hooks/useTokenInfos';
import { formatUnits } from 'viem';

export interface TokenInfo {
  address: `0x${string}`;
  symbol?: string;
  decimals?: number;
}

interface AmountInputProps {
  token?: TokenInfo; // 当前选中的 token
  amount: string; // 输入金额
  onAmountChange: (value: string) => void;
  onTokenSelect?: () => void; //点 token 选择器时触发:弹出 token 列表
  showMax?: boolean; //是否显示 Max 按钮（点击后amount是最大值，全部都卖出）
  readOnly?: boolean; //是否只读(一框输入，另一框只读显示报价)
  USDValue?: string | number; //美元估值
}

export const AmountInput = ({
  token,
  amount,
  onAmountChange,
  onTokenSelect,
  showMax = false,
  readOnly = false,
  USDValue = '0.00',
}: AmountInputProps) => {
  const tokenAddrs = useMemo(() => {
    return token ? [token.address] : [];
  }, [token]);

  const { tokenMap } = useTokenInfos(tokenAddrs);

  const tokenInfo = token ? tokenMap.get(token.address) : null;
  const symbol = tokenInfo?.symbol ?? token?.symbol ?? 'Token';
  const decimals = tokenInfo?.decimals ?? 18;
  const balanceRaw = tokenInfo?.balance;

  const balanceStr =
    balanceRaw !== undefined
      ? Number(formatUnits(balanceRaw, decimals)).toLocaleString('en-US', {
          maximumFractionDigits: 2,
        })
      : '0';

  const handleMax = () => {
    if (balanceRaw === undefined) return;
    onAmountChange(formatUnits(balanceRaw, decimals));
  };

  // 优化输入：只保留 1 个小数点、纯数字+小数点
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^\d.]/g, '');
    // 禁止多个小数点
    const dotCount = (val.match(/\./g) || []).length;
    if (dotCount > 1) val = val.slice(0, val.lastIndexOf('.'));
    // 禁止开头为 .
    if (val.startsWith('.')) val = val.slice(1);
    onAmountChange(val);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={handleInput}
          readOnly={readOnly}
          placeholder="0"
          className="flex-1 min-w-0 bg-transparent text-3xl font-medium outline-none placeholder:text-gray-300"
        />

        <button
          type="button"
          onClick={onTokenSelect}
          className="flex items-center gap-1.5 bg-white rounded-full pl-1 pr-3 py-1 shadow-sm hover:shadow shrink-0"
        >
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-medium">{symbol}</span>
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>${USDValue}</span>
        <div className="flex items-center gap-1">
          <span>Balance: {balanceStr}</span>
          {showMax && balanceRaw !== undefined && (
            <button
              type="button"
              onClick={handleMax}
              className="text-blue-600 font-medium hover:underline"
            >
              Max
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
