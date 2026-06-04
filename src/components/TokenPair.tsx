import { formatUnits } from "viem";

interface TokenPairProps {
    token0:`0x${string}`;
    token1:`0x${string}`;
    tokenMap:Map<string,{symbol:string;decimals:number;balance:bigint}>;
}

export const TokenPair = ({token0,token1,tokenMap}:TokenPairProps) => {
    const token0Info = tokenMap.get(token0.toLowerCase());
    const token1Info = tokenMap.get(token1.toLowerCase());

    //格式化展示余额 balance
    const fmt=(b?:bigint,d=18)=>{
        return b ? Number(formatUnits(b,d)).toFixed(3) : '-';
    }

    return (
        <span>
            <span className="font-medium">{token0Info?.symbol ?? '?'}</span>
            <span className="text-gray-400 ml-1">({fmt(token0Info?.balance,token0Info?.decimals)})</span>
            <span className="mx-2 text-gray-400"> / </span>
            <span className="font-medium">{token1Info?.symbol ?? '?'}</span>
            <span className="text-gray-400 ml-1">({fmt(token1Info?.balance,token1Info?.decimals)})</span>
        </span>
    )
}