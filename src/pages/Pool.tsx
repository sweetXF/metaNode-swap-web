import { useChainId, useReadContract } from "wagmi";
import { poolAbi } from "../abi/PoolManager";
import { getContractAddress } from "../config/contracts";
import { DataTable, type Column } from "../components/DataTable";
import { TokenPair } from "../components/TokenPair";
import { useTokenInfos } from "../hooks/useTokenInfos";
import { useMemo, useState } from "react";
import { formatBigInt, shortAddress } from "../utils/format";
import { formatFeeTier, formatPriceRange, sqrtPriceX96ToPrice } from "../utils/price";
import { useNavigate } from "react-router-dom";
import { Modal } from "../components/Modal";
import { ModalFooter } from "../components/ModalFooter";

type Pool={
    fee:number;  // 手续费率（所有 LP 共享）
    feeProtocol:number;
    index:number;
    liquidity:bigint; // 池子总流动性（所有 LP 累加）
    pool:`0x${string}`;
    sqrtPriceX96:bigint; // 当前价格
    tick:number;
    tickLower:number;
    tickUpper:number;
    token0:`0x${string}`;
    token1:`0x${string}`;
}

export const PoolPage = () => {
    const navigate = useNavigate();
    const chainId = useChainId();

    const [openAddPool, setOpenAddPool] = useState(false);

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

    const {tokenMap}=useTokenInfos(allTokenAddrs);

    const handleAddPool=()=>{
      console.log('add pool');
    }

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
              {/* 需在App.tsx中添加路由<Route path="/position" element={<PositionPage />} /> */}
                <button className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition"
                onClick={() => navigate('/position')}>
                  My Positions
                </button>

                <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  onClick={() => setOpenAddPool(true)}>
                  Add Pool
                </button>
              <Modal isOpen={openAddPool} onClose={() => setOpenAddPool(false)} title="Add Pool" 
                footer={<ModalFooter onClose={() => setOpenAddPool(false)} handleAddClick={() => handleAddPool()}/>}
                >
                <p>TODO: Add Pool</p>
              </Modal>

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