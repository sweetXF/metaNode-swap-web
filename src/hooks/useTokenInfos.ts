import { useMemo } from 'react';
import { erc20Abi } from 'viem';
import { useAccount, useReadContracts } from 'wagmi';

// useTokenInfos ：接收 (token, holder) 对的数组
type TokenHolderPair = { token: `0x${string}`; holder?: `0x${string}` };

export const useTokenInfos = (pairs: TokenHolderPair[]) => {
  const { address: user } = useAccount();

  // 一次性读：每个 pair 都生成 symbol 、 decimals 、 balance(holder ?? user) 三个调用
  const { data, isLoading: isTokenInfoLoading } = useReadContracts({
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

  //token address  -> { symbol, decimals, balance, owner}
  const tokenMap = useMemo(() => {
    const m = new Map<
      string,
      { symbol: string; decimals: number; balance?: bigint; owner?: `0x${string}` }
    >();
    pairs.forEach(({ token, holder }, i) => {
      const owner = holder ?? user;
      const symbol = data?.[i * 3]?.result as string;
      const decimals = (data?.[i * 3 + 1]?.result as number) ?? 18;
      const balance = owner ? ((data?.[i * 3 + 2]?.result as bigint) ?? 0n) : undefined;
      const key = `${token}`;
      m.set(key, { symbol, decimals, balance, owner });
    });
    return m;
  }, [data, pairs, user]);

  return { tokenMap, isTokenInfoLoading };
};
