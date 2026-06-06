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
import { AmountInput, type TokenInfo } from "../components/AmountInput";
import { FeeTierSelect } from "../components/FeeTierSelect";
import { CellInput } from "../components/CellInput";

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

// 临时硬编码 token（后续应该从 token 列表取）
const ETH: TokenInfo = {
  address: "0x4798388e3adE569570Df626040F07DF71135C48E",
  symbol: "ETH",
};
const XRP: TokenInfo = {
  address: "0x86B5bd6FFf459854ca91318274E47F4eEE245CF28",
  symbol: "XRP",
};

export const PoolPage = () => {
    const navigate = useNavigate();
    const chainId = useChainId();

    const [openAddPool, setOpenAddPool] = useState(false);
    
    const [tokenIn, setTokenIn] = useState<TokenInfo>(ETH);
    const [tokenOut, setTokenOut] = useState<TokenInfo>(XRP);
    const [amountIn, setAmountIn] = useState("");
    const [amountOut, setAmountOut] = useState("");
    const [fee, setFee] = useState<number>();
    const [lowPrice, setLowPrice] = useState("");
    const [highPrice, setHighPrice] = useState("");
    const [currentPrice, setCurrentPrice] = useState("");

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
      // writeContract({
      //   functionName: 'createPool',
      //   args: [{
      //     token0,
      //     token1,
      //     fee,
      //     tickLower: priceToTick(lowPrice),
      //     tickUpper: priceToTick(highPrice),
      //     sqrtPriceX96: priceToSqrtPriceX96(currentPrice),  // ← 这里
      //   }],
      // })
      // setOpenAddPool(false);      
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
          <p className="text-2xl font-semibold text-gray-900 mb-2 text-center py-2">Pool</p>
  
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
                <p className="text-sm pb-1"><span className="text-red-500">*</span>Deposit amounts</p>
                <div className="space-y-1">
                    <AmountInput
                    token={tokenIn}
                    amount={amountIn}
                    onAmountChange={setAmountIn}
                    onTokenSelect={() => console.log("open token list (in)")}
                    showMax
                    />
                    <AmountInput
                    token={tokenOut}
                    amount={amountOut}
                    onAmountChange={setAmountOut}
                    onTokenSelect={() => console.log("open token list (out)")}
                    // readOnly
                    />
                </div>

                <p className="text-sm pt-3 pb-1"><span className="text-red-500">*</span>Fee tier</p>
                <FeeTierSelect
                  disabled={!tokenIn || !tokenOut}
                  value={fee}
                  onChange={setFee} />

                <p className="text-sm pt-3 pb-1"><span className="text-red-500">*</span>Set price range</p>
                <div className="grid grid-cols-2 gap-3">
                    <CellInput
                        value={lowPrice}
                        onChange={setLowPrice}
                        placeholder="Low price"
                        disabled={!tokenIn || !tokenOut}
                        // unit={`${symbol1} per ${symbol0}`}
                    />
                    <CellInput
                        value={highPrice}
                        onChange={setHighPrice}
                        placeholder="High price"
                        disabled={!tokenIn || !tokenOut}
                    />
              </div>

              <p className="text-sm pt-3 pb-1"><span className="text-red-500">*</span>Current price</p>
                  <CellInput
                        value={currentPrice}
                        onChange={setCurrentPrice}
                        placeholder="current price"
                        disabled={!tokenIn || !tokenOut}
                    />
                
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