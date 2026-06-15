import { formatBigInt, shortAddress } from '../utils/format';

interface TokenPairProps {
  token0: `0x${string}`;
  token1: `0x${string}`;
  tokenMap: Map<
    string,
    { symbol: string; decimals: number; balance?: bigint; owner?: `0x${string}` }
  >;
}

export const TokenPair = ({ token0, token1, tokenMap }: TokenPairProps) => {
  const token0Info = tokenMap.get(token0);
  const token1Info = tokenMap.get(token1);

  return (
    <span>
      <span className="font-medium">{token0Info?.symbol ?? shortAddress(token0)}</span>
      <span className="text-gray-400 ml-1">
        ({formatBigInt(token0Info?.balance, token0Info?.decimals)})
      </span>
      <span className="mx-2 text-gray-400"> / </span>
      <span className="font-medium">{token1Info?.symbol ?? shortAddress(token1)}</span>
      <span className="text-gray-400 ml-1">
        ({formatBigInt(token1Info?.balance, token1Info?.decimals)})
      </span>
    </span>
  );
};
