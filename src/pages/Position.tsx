import { useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { DataTable, type Column } from "../components/DataTable"
import { getContractAddress } from "../config/contracts"
import { positionAbi } from "../abi/PositionManager"
import { shortAddress } from "../utils/format"
import { formatFeeTier, formatPriceRange, sqrtPriceX96ToPrice } from "../utils/price"
import { useEffect } from "react"

type Position={
    fee:number;
    feeGrowthInside0LastX128:bigint;
    feeGrowthInside1LastX128:bigint;
    id:bigint; // 仓位编号（NFT tokenId）
    index:number; // 位置编号,属于哪个 pool
    liquidity:bigint; // 这个用户在 pool 里的流动性份额
    owner:`0x${string}`;  // 拥有者（具体用户）
    tickLower:number;  // 用户主动选择的窄区间
    tickUpper:number;
    token0:`0x${string}`;
    token1:`0x${string}`;
    tokensOwed0:bigint; // 累积未领取的手续费 (token0)
    tokensOwed1:bigint; // 累积未领取的手续费 (token1)
}

export const PositionPage = () => {
    const chainId = useChainId();
    const {data:positions,isLoading ,error,refetch} =useReadContract({
        address:getContractAddress(chainId,'PositionManager'),
        abi:positionAbi,
        functionName:"getAllPositions",  
        query:{
            enabled:!!chainId
        }
    })

    console.log('positions',positions);

    // writeContract
    // isPending:等待用户在钱包确认
    const {writeContract,data:txHash,isPending,error:writeError} = useWriteContract();

    // 等待交易上链确认
    // isLoading : 已发出但还未确认（等出块）
    const {isLoading:isConfirming, isSuccess:isConfirmed,isError }=useWaitForTransactionReceipt({
        hash:txHash,
        query:{
            enabled:!!txHash
        }
    });

      // 交易确认后自动刷新列表
    useEffect(()=>{
        if(isConfirmed) {
            refetch();
        }
    },[isConfirmed,refetch]);

    const handleRemove = (row:Position) => {
        writeContract({
            address:getContractAddress(chainId,'PositionManager'),
            abi:positionAbi,
            functionName:"burn",
            args:[row.id],
        })
        console.log('remove position',row);
    }

    const handleCollect = (row:Position) => {
        console.log('collect position',row);
    }

    const columns : Column<Position>[] = [
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
                // {
                //     key:'price',
                //     label:'Current price',
                //     render:(row) => sqrtPriceX96ToPrice(row.sqrtPriceX96).toFixed(3),
                // },
                {
                    key:'id',
                    label:'Position id',
                    render:(row) => row.id,
                },
                {
                    key:'actions',
                    label:'Actions',
                    render:(row) => (
                        <div className="flex items-center gap-2">
                            <button
                                disabled={isPending || isConfirming}
                                className="text-blue-600 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => handleRemove(row)}
                            >
                                {isPending ? 'Pending...' : isConfirming ? 'Confirming...' : 'Remove'}
                            </button>
                            <button
                                disabled={isPending || isConfirming}
                                className="text-blue-600 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => handleCollect(row)}
                            >
                                Collect
                            </button>
                        </div>
                    )
                },
    ]

    return (
        <div className="min-h-screen bg-gray-50 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-2xl font-semibold text-gray-900 mb-2 text-left">Positions</p>
  
          <DataTable<Position>
            title="My Positions"
            extra={
              <>
                <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                  Add
                </button>
              </>
            }
            columns={columns}
            data={positions as Position[] | undefined}
            loading={isLoading}
            error={error}
          />
        </div>
      </div>
    )
}