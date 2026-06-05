import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { DataTable, type Column } from "../components/DataTable"
import { getContractAddress } from "../config/contracts"
import { positionAbi } from "../abi/PositionManager"
import { shortAddress } from "../utils/format"
import { formatFeeTier, formatPriceRange, sqrtPriceX96ToPrice } from "../utils/price"
import { useEffect } from "react"

type Position={
    fee:number;
    feeGrowthInside0LastX128:bigint; //上次提取手续费时的 feeGrowthGlobal0X128
    feeGrowthInside1LastX128:bigint; // 上次提取手续费时的 feeGrowthGlobal1X128
    id:bigint; // 仓位编号 positionId
    index:number; // 位置编号,属于哪个 pool
    liquidity:bigint; // 该 Position 拥有的流动性
    owner:`0x${string}`;  // 拥有者（具体用户）
    tickLower:number;  // 用户主动选择的窄区间
    tickUpper:number;
    token0:`0x${string}`;
    token1:`0x${string}`;
    tokensOwed0:bigint; // 可提取的 token0 数量
    tokensOwed1:bigint; // 可提取的 token1 数量
}

export const PositionPage = () => {
    const chainId = useChainId();
    const {isConnected,chainId:curChainId}=useAccount();
   const isChainidMatch=curChainId===chainId;

    const {data:positions,isLoading ,error,refetch} =useReadContract({
        address:getContractAddress(chainId,'PositionManager'),
        abi:positionAbi,
        functionName:"getAllPositions",  
        query:{
            enabled:isConnected && !!chainId && isChainidMatch
        }
    })

    // isPending：等待用户在钱包确认。 
    // txHash：交易已提交后的 tx 哈希。
    // error： 用户拒绝 / 模拟失败等错误
    const {writeContract,data:txHash,isPending,error:writeError} = useWriteContract();

    // 等待交易上链确认
    // isLoading：已发出但还未确认（等出块）
    // isSuccess： 交易已成功上链
    // isError： 交易失败 / 被回滚
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
        console.log('remove position：',row);
        console.log('txhash isPending writeError：',txHash,isPending,writeError)
        console.log('isConfirming isSuccess isError：',isConfirming,isConfirmed,isError);
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

    if(!isConnected || !isChainidMatch) {
        return (
                <div className="max-w-7xl mx-auto p-5">
                    <p className="text-2xl font-semibold text-gray-900 mb-2 text-left">Positions</p>
                    {
                        !isConnected && <p className="text-gray-500">Connect your wallet</p> 
                    }
                    {
                        isConnected && !isChainidMatch && <p className="text-gray-500">Connect your wallet to Sepolia network</p>
                    }
                    
                </div>
        )
    }

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