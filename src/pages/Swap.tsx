import { useCallback, useEffect, useRef, useState } from 'react';
import { AmountInput, type TokenInfo } from '../components/AmountInput';
import { TokenList } from '../components/TokenList';
import { Selecting } from '../config/types';
import { useAccount, useChainId, useWriteContract } from 'wagmi';
import { usePositionApproval } from '../hooks/usePositionApproval';
import { simulateContract, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '../wagmi';
import { getContractAddress } from '../config/contracts';
import { swapRouterAbi } from '../abi/SwapRouter';
import { formatBigInt, formatToBigInt } from '../utils/format';
import { useDebounce } from '../hooks/useDebounce';
import { formatUnits } from 'viem';

// 临时硬编码 token（后续应该从 token 列表取）
const TOKEN_LIST: TokenInfo[] = [
  { address: '0x4798388e3adE569570Df626040F07DF71135C48E', symbol: 'MNTokenA' },
  { address: '0x5A4eA3a013D42Cfd1B1609d19f6eA998EeE06D30', symbol: 'MNTokenB' },
  { address: '0x86B5df6FF459854ca91318274E47F4eEE245CF28', symbol: 'MNTokenC' },
  { address: '0x7af86B1034AC4C925Ef5C3F637D1092310d83F03', symbol: 'MNTokenD' },
];

export const SwapPage = () => {
  const chainId = useChainId();
  const { address: account, isConnected, chainId: curChainId } = useAccount();
  const isChainidMatch = curChainId === chainId;

  const SwapRouterAddress = getContractAddress(chainId, 'SwapRouter');

  const [tokenIn, setTokenIn] = useState<TokenInfo>(TOKEN_LIST[0]);
  const [tokenOut, setTokenOut] = useState<TokenInfo>(TOKEN_LIST[1]);
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');

  const requestIdRef = useRef(0);

  // 哪个输入框正在输入
  type InputSource = 'in' | 'out' | null;
  const [inputSource, setInputSource] = useState<InputSource>(null);

  const { isApproved, ensureApproved } = usePositionApproval();
  const { writeContractAsync } = useWriteContract();
  const [swapError, setSwapError] = useState('');

  //用一个 state 统一管理"哪个输入框正在选 token"
  const [selecting, setSelecting] = useState<Selecting>();
  const selectedToken =
    selecting === Selecting.In ? tokenIn : selecting === Selecting.Out ? tokenOut : undefined;

  // tokens 弹窗选中 token 时触发
  // 如果选中的是另一边的 token，自动交换。（也可传disabledAddresses，禁选另一边的token）
  const handleSelectToken = (token: TokenInfo) => {
    if (selecting === Selecting.In) {
      //如： 用户在 In 选了 XRP，但 Out 已经是 XRP，就把 Out 设为旧的 In（ETH），变成"交换两边"
      if (token.address === tokenOut.address) {
        setTokenOut(tokenIn);
      }
      setTokenIn(token);
    } else if (selecting === Selecting.Out) {
      if (token.address === tokenIn.address) {
        setTokenIn(tokenOut);
      }
      setTokenOut(token);
    }
  };

  // 对输入值做防抖，延迟 300ms
  const debouncedAmountIn = useDebounce(amountIn, 300);
  const debouncedAmountOut = useDebounce(amountOut, 300);

  // 正向询价 in -> out
  const fetchQuoteIn = useCallback(
    async (reqId: number) => {
      const val = debouncedAmountIn;
      if (!val) {
        setAmountOut('');
        return;
      }
      if (isNaN(+val) || +val <= 0) {
        if (reqId === requestIdRef.current) {
          setSwapError('Amount in must be greater than 0');
          setAmountOut('');
        }
        return;
      }
      try {
        const { result: outRaw } = await simulateContract(wagmiConfig, {
          address: SwapRouterAddress,
          abi: swapRouterAbi,
          functionName: 'quoteExactInput',
          args: [
            {
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              amountIn: formatToBigInt(debouncedAmountIn, tokenIn.decimals ?? 18),
              indexPath: [0],
              sqrtPriceLimitX96: 0n,
            },
          ],
        });

        //判断是否是最新的那次请求。 如果不是，就返回
        if (reqId !== requestIdRef.current) return;
        // setAmountOut(formatBigInt(outRaw, tokenOut.decimals ?? 18));
        setAmountOut(formatUnits(outRaw, tokenOut.decimals ?? 18));
        setSwapError('');
      } catch (error: unknown) {
        if (reqId !== requestIdRef.current) return; // 过期错误也丢弃
        const msg =
          (error as { shortMessage?: string; message?: string })?.shortMessage ||
          (error as Error)?.message ||
          'Failed to get quote';
        console.error('quoteExactInput failed:', error);
        setSwapError(msg);
        setAmountOut('');
      }
    },
    [debouncedAmountIn, tokenIn, tokenOut, SwapRouterAddress]
  );

  // 反向询价：out -> in
  const fetchQuoteOut = useCallback(
    async (reqId: number) => {
      const val = debouncedAmountOut;
      // 空字符串：静默
      if (!val) {
        setAmountIn('');
        return;
      }
      if (isNaN(+val) || +val <= 0) {
        if (reqId === requestIdRef.current) {
          setSwapError('Amount out must be greater than 0');
          setAmountIn('');
        }
        return;
      }
      try {
        // 询价
        const { result: inRaw } = await simulateContract(wagmiConfig, {
          address: SwapRouterAddress,
          abi: swapRouterAbi,
          functionName: 'quoteExactOutput',
          args: [
            {
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              amountOut: formatToBigInt(debouncedAmountOut, tokenOut.decimals ?? 18),
              indexPath: [0],
              sqrtPriceLimitX96: 0n,
            },
          ],
        });

        //判断是否是最新的那次请求。 如果不是，就返回
        if (reqId !== requestIdRef.current) return;

        setAmountIn(formatUnits(inRaw, tokenIn.decimals ?? 18));
        setSwapError('');
      } catch (error: unknown) {
        if (reqId !== requestIdRef.current) return;
        const msg =
          (error as { shortMessage?: string; message?: string })?.shortMessage ||
          (error as Error)?.message ||
          'Failed to get quote';
        console.error('quoteExactOutput failed:', error);
        setSwapError(msg);
        setAmountIn('');
      }
    },
    [debouncedAmountOut, tokenIn, tokenOut, SwapRouterAddress]
  );

  const handleAmountInChange = (amount: string) => {
    setInputSource('in');
    setAmountIn(amount);
    setAmountOut('');
  };

  const handleAmountOutChange = (amount: string) => {
    setInputSource('out');
    setAmountOut(amount);
    setAmountIn('');
  };

  //防抖值变化 → 执行询价
  useEffect(() => {
    if (!tokenIn || !tokenOut || !inputSource) return;

    const reqId = ++requestIdRef.current; // 自增，旧请求的 reqId 立刻变"过期"
    if (inputSource === 'in') {
      fetchQuoteIn(reqId);
    } else if (inputSource === 'out') {
      fetchQuoteOut(reqId);
    }
  }, [inputSource, fetchQuoteIn, fetchQuoteOut]);

  useEffect(() => {
    setAmountOut('');
    setAmountIn('');
    setSwapError('');
  }, [tokenIn, tokenOut]);

  //  点击 Swap 按钮时触发
  const handleSwap = () => {
    console.log('swap', { tokenIn, tokenOut, amountIn });
    // TODO: 调 SwapRouter
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-2xl font-semibold text-gray-900 mb-2 text-center py-2">Swap</p>
          <div className="space-y-1">
            <AmountInput
              token={tokenIn}
              amount={amountIn}
              onAmountChange={handleAmountInChange}
              onTokenSelect={() => setSelecting(Selecting.In)}
              showMax
            />

            <AmountInput
              token={tokenOut}
              amount={amountOut}
              onAmountChange={handleAmountOutChange}
              onTokenSelect={() => setSelecting(Selecting.Out)}
              // readOnly
            />
          </div>

          {/* Token 选择弹窗（只渲染一次，根据 selecting 状态决定开关） */}
          <TokenList
            tokens={TOKEN_LIST}
            open={selecting !== undefined}
            onClose={() => setSelecting(undefined)}
            onSelect={handleSelectToken}
            selected={selectedToken}
            // 如果不想要"自动交换in Out"行为，可选：直接禁选（置灰）列表中另一边的token
            // disabledAddresses={
            //   selecting === Selecting.In ? [tokenOut.address] :
            //   selecting === Selecting.Out ? [tokenIn.address] : []
            // }
          />

          {swapError ? <p className="text-red-500 p-2 text-sm">{swapError}</p> : null}

          <button
            onClick={handleSwap}
            disabled={!amountIn || Number(amountIn) === 0 || !isConnected || !isChainidMatch}
            className="w-full mt-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isConnected ? (isChainidMatch ? 'Swap' : 'Connect to Sepolia') : 'Connect wallet'}
          </button>
        </div>
      </div>
    </div>
  );
};
