import { useMemo } from 'react';
import { erc20Abi } from 'viem';
import { useAccount, useReadContracts } from 'wagmi';

// useTokenInfos ：接收 (token, holder) 对的数组
type TokenHolderPair = { token: `0x${string}`; holder?: `0x${string}` };

export const usePoolTokenInfos = (pairs: TokenHolderPair[]) => {
  const { address: user } = useAccount();

  // 一次性读：每个 pair 都生成 symbol + decimals + balance(holder ?? user) 三个调用
  const { data } = useReadContracts({
    contracts: pairs.flatMap(({ token, holder }) => {
      const owner = holder ?? user;
      return [
        { address: token, abi: erc20Abi, functionName: 'symbol' },
        { address: token, abi: erc20Abi, functionName: 'decimals' },
        ...(owner
          ? [{ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }]
          : []),
      ];
    }),
    query: { enabled: pairs.length > 0 },
  });

  // 用 `${token}` 作为 key
  const tokenMap = useMemo(() => {
    const m = new Map<string, { symbol: string; decimals: number; balance?: bigint }>();
    let idx = 0;
    pairs.forEach(({ token, holder }) => {
      const owner = holder ?? user;
      const symbol = data?.[idx++]?.result as string;
      const decimals = (data?.[idx++]?.result as number) ?? 18;
      const balance = owner ? ((data?.[idx++]?.result as bigint) ?? 0n) : undefined;
      const key = `${token}`;
      m.set(key, { symbol, decimals, balance });
    });
    return m;
  }, [data, pairs, user]);

  return { tokenMap };
};
