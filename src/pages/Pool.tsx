import { useChainId, useReadContract } from "wagmi";
import { poolAbi } from "../abi/PoolManager";
import { getContractAddress } from "../config/contracts";
import { DataTable, type Column } from "../components/DataTable";
import { TokenPair } from "../components/TokenPair";
import { useTokenInfos } from "../hooks/useTokenInfos";
import { useMemo } from "react";
import { formatBigInt, shortAddress } from "../utils/format";
import { formatFeeTier, formatPriceRange, sqrtPriceX96ToPrice } from "../utils/price";

type Pool={
    fee:number;
    feeProtocol:number;
    index:number;
    liquidity:bigint;
    pool:`0x${string}`;
    sqrtPriceX96:bigint;
    tick:number;
    tickLower:number;
    tickUpper:number;
    token0:`0x${string}`;
    token1:`0x${string}`;
}

export const PoolPage = () => {
    const chainId = useChainId();

    const {data:pools,isLoading ,error} =useReadContract({
        address:getContractAddress(chainId,'PoolManager'),
        abi:poolAbi,
        functionName:"getAllPools",  
        query:{
            enabled:!!chainId
        } 
    })

    // 收集所有不重复的 token 地址
    const allTokenAddrs = useMemo(()=>{
      const set = new Set<`0x${string}`>();
      pools?.forEach((pool) => {
          set.add(pool.token0);
          set.add(pool.token1);
      })
      return [...set];
    },[pools])

    console.log('poolmanager pools',pools);

    const {tokenMap}=useTokenInfos(allTokenAddrs);

    // render:(row) => <TokenPair token0={row.token0} token1={row.token1} tokenMap={tokenMap} />,
    // render:(row) => `${shortAddress(row.token0)} / ${shortAddress(row.token1)}`,
   const columns : Column<Pool>[] = [
        {
            key:'token',
            label:'Token',
            render:(row) => `${shortAddress(row.token0)} / ${shortAddress(row.token1)}`
        },
        {
            key:'fee',
            label:'Fee tier',
            render:(row) => formatFeeTier(row.fee),
        },
        {
            key:'range',
            label:'Set price range',
            render:(row) => formatPriceRange(row.tickLower,row.tickUpper),
        },
        {
            key:'price',
            label:'Current price',
            render:(row) => sqrtPriceX96ToPrice(row.sqrtPriceX96).toFixed(3),
        },
        {
            key:'liquidity',
            label:'Liquidity',
            render:(row) => formatBigInt(row.liquidity),
        },
        ]
        
    return (
        <div className="min-h-screen bg-gray-50 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-2xl font-semibold text-gray-900 mb-2 text-left">Pool</p>
  
          <DataTable<Pool>
            title="Pool list"
            extra={
              <>
                <button className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition">
                  My Positions
                </button>
                <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                  Add Pool
                </button>
              </>
            }
            columns={columns}
            data={pools as Pool[] | undefined}
            loading={isLoading}
            error={error}
          />
        </div>
      </div>
    )
}