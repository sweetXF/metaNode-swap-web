import { useCallback, useEffect, useRef, useState } from 'react';
import { AmountInput } from '../components/AmountInput';
import { TokenList } from '../components/TokenList';
import { Selecting, type TokenInfo } from '../config/types';
import { useAccount, useChainId, useWriteContract } from 'wagmi';
import { simulateContract, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '../wagmi';
import { getContractAddress } from '../config/contracts';
import { swapRouterAbi } from '../abi/SwapRouter';
import { formatBigInt, formatToBigInt } from '../utils/format';
import { useDebounce } from '../hooks/useDebounce';
import { formatUnits } from 'viem';
import { useTokenList } from '../hooks/useTokenList';
import { CellInput } from '../components/CellInput';
import { getSwapBestPoolAndPriceLimit } from '../utils/getSwapBestPoolAndPriceLimit';
import { errorMsg } from '../config/errorMsg';
import { useErc20Approval } from '../hooks/useErc20Approval';

export const SwapPage = () => {
  const chainId = useChainId();
  const { address: account, isConnected, chainId: curChainId } = useAccount();
  const isChainidMatch = curChainId === chainId;

  const SwapRouterAddress = getContractAddress(chainId, 'SwapRouter');

  const [deadline, setDeadline] = useState('30'); //延迟时间，分钟
  const [maxSlippage, setMaxSlippage] = useState('5.5'); //最大滑点，百分比

  const { tokenList } = useTokenList();
  const [tokenIn, setTokenIn] = useState<TokenInfo>();
  const [tokenOut, setTokenOut] = useState<TokenInfo>();
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');

  useEffect(() => {
    if (tokenList.length < 2) return;
    setTokenIn(prev => prev ?? tokenList[0]);
    setTokenOut(prev => prev ?? tokenList[1]);
  }, [tokenList]);

  /** 滑点限价：
   * zeroForOne = true（token0 → token1 卖出 token0, 买入 token1,价格下行）：sqrtPriceLimitX96 必须 小于当前价格，且大于最小价格。价格跌到 sqrtPriceLimitX96 就停止交易，防止滑点过大、亏太多
   * zeroForOne = false（token1 → token0 卖出 token1,买入 token0,价格上行）：sqrtPriceLimitX96 必须 大于当前价格，且小于最大价格
   */
  // 价格边界常量, 池子允许的最小、最大 sqrtPriceX96
  const MIN_SQRT_PRICE = 4295128739n; //池子能到达的最低开方价格（对应 tick 下限）
  const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n; //池子能到达的最高开方价格（对应 tick 上限）
  /**根据交易方向计算合法的 sqrtPriceLimitX96。
   * zeroForOne(价格下行) → MIN_SQRT_PRICE + 1；否则(价格上行) → MAX_SQRT_PRICE - 1
   * 限价设为 MIN_SQRT_PRICE + 1n：几乎允许价格跌到最低，几乎无滑点限制
   * 限价设为 MAX_SQRT_PRICE - 1n：几乎允许价格涨到最高，几乎无滑点限制
   */
  const getSqrtPriceLimit = (inAddr: string, outAddr: string) => {
    const zeroForOne = inAddr.toLowerCase() < outAddr.toLowerCase(); //通过代币地址字典序判断交易方向
    return zeroForOne ? MIN_SQRT_PRICE + 1n : MAX_SQRT_PRICE - 1n; //无限滑点兜底限价
  };

  const requestIdRef = useRef(0);

  // 哪个输入框正在输入
  type InputSource = 'in' | 'out' | null;
  const [inputSource, setInputSource] = useState<InputSource>(null);

  const { writeContractAsync, isPending } = useWriteContract();
  const [swapError, setSwapError] = useState('');

  //用一个 state 统一管理"哪个输入框正在选 token"
  const [selecting, setSelecting] = useState<Selecting>();
  const selectedToken =
    selecting === Selecting.In ? tokenIn : selecting === Selecting.Out ? tokenOut : undefined;

  // tokens 弹窗选中 token 时触发
  // 如果选中的是另一边的 token，自动交换。（也可传disabledAddresses，禁选另一边的token）
  const handleSelectToken = (token: TokenInfo) => {
    if (!tokenOut || !tokenIn) return;
    if (selecting === Selecting.In) {
      //如： 用户在 In 选了 XRP，但 Out 已经是 XRP，就把 Out 设为旧的 In（ETH），变成"交换两边"
      if (token.address === tokenOut.address) {
        setTokenOut(tokenIn);
      }
      setTokenIn(token);
      setAmountIn('');
      setAmountOut('');
    } else if (selecting === Selecting.Out) {
      if (token.address === tokenIn.address) {
        setTokenIn(tokenOut);
      }
      setTokenOut(token);
      setAmountIn('');
      setAmountOut('');
    }
  };

  // 对输入值做防抖，延迟 300ms
  const debouncedAmountIn = useDebounce(amountIn, 300);
  const debouncedAmountOut = useDebounce(amountOut, 300);

  // 正向询价 in -> out
  const fetchQuoteIn = useCallback(
    async (reqId: number) => {
      if (!tokenIn || !tokenOut) return;
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
        const { bestPoolIndex } = await getSwapBestPoolAndPriceLimit(
          chainId,
          tokenIn.address,
          tokenOut.address,
          maxSlippage
        );

        const { result: outRaw } = await simulateContract(wagmiConfig, {
          address: SwapRouterAddress,
          abi: swapRouterAbi,
          functionName: 'quoteExactInput',
          args: [
            {
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              amountIn: formatToBigInt(debouncedAmountIn, tokenIn.decimals ?? 18),
              indexPath: [bestPoolIndex],
              sqrtPriceLimitX96: getSqrtPriceLimit(tokenIn.address, tokenOut.address),
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
        const msg = errorMsg(error, 'quoteExactInput failed');
        setSwapError(msg);
        setAmountOut('');
      }
    },
    [debouncedAmountIn, tokenIn, tokenOut, SwapRouterAddress]
  );

  // 反向询价：out -> in
  const fetchQuoteOut = useCallback(
    async (reqId: number) => {
      if (!tokenIn || !tokenOut) return;
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
        const { bestPoolIndex } = await getSwapBestPoolAndPriceLimit(
          chainId,
          tokenIn.address,
          tokenOut.address,
          maxSlippage
        );
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
              indexPath: [bestPoolIndex],
              sqrtPriceLimitX96: getSqrtPriceLimit(tokenIn.address, tokenOut.address),
            },
          ],
        });

        //判断是否是最新的那次请求。 如果不是，就返回
        if (reqId !== requestIdRef.current) return;

        setAmountIn(formatUnits(inRaw, tokenIn.decimals ?? 18));
        setSwapError('');
      } catch (error: unknown) {
        if (reqId !== requestIdRef.current) return;
        const msg = errorMsg(error, 'quoteExactOutput failed');
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

  // token 变化时，重置所有状态
  useEffect(() => {
    // 作废所有在途/即将由旧防抖值触发的询价：
    // 切 token 时 fetchQuoteIn/Out 会因依赖变化被重建并触发一次询价，
    // 但此时 debouncedAmountIn/Out 仍是旧值，会把刚清空的金额重新填回来。
    // 自增 requestId 后，那笔旧询价 resolve 时 reqId 不匹配会被丢弃。
    requestIdRef.current++;
    setAmountOut('');
    setAmountIn('');
    setSwapError('');
    setInputSource(null);
  }, [tokenIn, tokenOut]);

  const { approveToken, ensureApprovedAllowance } = useErc20Approval(
    tokenIn?.address,
    SwapRouterAddress
  );
  //  点击 Swap 按钮时触发
  const handleSwap = async () => {
    if (!account) {
      setSwapError('Please connect your wallet');
      return;
    }
    if (+maxSlippage < 0 || +maxSlippage > 100) {
      setSwapError('Max slippage must be between 0 and 100');
      return;
    }
    if (+deadline < 30 || +deadline > 4320) {
      setSwapError('Deadline must be between 30 and 4320');
      return;
    }
    if (!tokenIn || !tokenOut) {
      setSwapError('Please select tokens');
      return;
    }
    if (!amountIn || !amountOut) {
      setSwapError('Please enter amount');
      return;
    }
    // 校验用户输入的那一侧 > 0
    if (!+amountIn && inputSource === 'in') {
      setSwapError('Amount in must be greater than 0');
      return;
    }
    if (!+amountOut && inputSource === 'out') {
      setSwapError('Amount out must be greater than 0');
      return;
    }
    // 校验询价回填的另一侧是否就绪; 如果另一侧未就绪，返回
    if (!inputSource) return;
    if (inputSource === 'in' && !amountOut) {
      setSwapError('Quote not ready, please wait');
      return;
    }
    if (inputSource === 'out' && !amountIn) {
      setSwapError('Quote not ready, please wait');
      return;
    }

    const rawAmountIn = formatToBigInt(amountIn, tokenIn.decimals ?? 18);
    const rawAmountOut = formatToBigInt(amountOut, tokenOut.decimals ?? 18);

    const slippageBps = BigInt(Math.round(+maxSlippage * 100));

    // deadline：当前时间戳 + 分钟*60（合约要求秒级时间戳）
    const now = Math.floor(Date.now() / 1000);
    const deadlineTs = BigInt(now + Number(deadline) * 60);
    // 调 SwapRouter 的 exactInput、 exactOutput
    try {
      //获取最优池和限价
      const { bestPoolIndex, sqrtPriceLimit } = await getSwapBestPoolAndPriceLimit(
        chainId,
        tokenIn.address,
        tokenOut.address,
        maxSlippage
      );
      if (inputSource === 'in') {
        //是否授权足够额度
        const approveTokenIn = await ensureApprovedAllowance(rawAmountIn);
        if (!approveTokenIn) {
          setSwapError('Please approve token in');
          return;
        }
        // 固定输入，最小输出 = 预期输出 * (1-滑点)
        const minAmountOutRaw = (rawAmountOut * (10000n - slippageBps)) / 10000n;

        const { request } = await simulateContract(wagmiConfig, {
          address: SwapRouterAddress,
          abi: swapRouterAbi,
          functionName: 'exactInput',
          args: [
            {
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              indexPath: [bestPoolIndex],
              recipient: account,
              deadline: deadlineTs,
              amountIn: rawAmountIn,
              amountOutMinimum: minAmountOutRaw,
              sqrtPriceLimitX96:
                sqrtPriceLimit && sqrtPriceLimit > 0n
                  ? sqrtPriceLimit
                  : getSqrtPriceLimit(tokenIn.address, tokenOut.address),
            },
          ],
          account,
        });
        const hash = await writeContractAsync(request);
        await waitForTransactionReceipt(wagmiConfig, { hash });
      } else if (inputSource === 'out') {
        // 固定输出，最大输入 = 预期输入 * (1+滑点)
        const maxAmountInRaw = (rawAmountIn * (10000n + slippageBps)) / 10000n;
        //是否授权足够额度
        const approveTokenIn = await ensureApprovedAllowance(maxAmountInRaw);
        if (!approveTokenIn) {
          setSwapError('Please approve token in');
          return;
        }

        const { request } = await simulateContract(wagmiConfig, {
          address: SwapRouterAddress,
          abi: swapRouterAbi,
          functionName: 'exactOutput',
          args: [
            {
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              indexPath: [bestPoolIndex],
              recipient: account,
              deadline: deadlineTs,
              amountOut: rawAmountOut,
              amountInMaximum: maxAmountInRaw,
              sqrtPriceLimitX96:
                sqrtPriceLimit && sqrtPriceLimit > 0n
                  ? sqrtPriceLimit
                  : getSqrtPriceLimit(tokenIn.address, tokenOut.address),
            },
          ],
          account,
        });
        const hash = await writeContractAsync(request);
        await waitForTransactionReceipt(wagmiConfig, { hash });
      }
      alert('Swap success');
    } catch (error: unknown) {
      const msg = errorMsg(error, 'Swap failed');
      setSwapError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-2xl font-semibold text-gray-900 mb-2 text-center py-2">Swap</p>
          <div className="grid grid-cols-2 gap-3 text-left">
            <p className="text-sm pt-3 pb-1">Max slippage</p>
            <p className="text-sm pt-3 pb-1">Deadline</p>
          </div>

          <div className="grid grid-cols-2 gap-3 pb-3">
            <CellInput
              value={maxSlippage}
              onChange={setMaxSlippage}
              placeholder="max slippage"
              disabled={!tokenIn || !tokenOut}
              isAdjust={false}
              endText="%"
            />
            <CellInput
              value={deadline}
              onChange={setDeadline}
              placeholder="deadline"
              disabled={!tokenIn || !tokenOut}
              isAdjust={false}
              endText="min"
            />
          </div>
          <div className="space-y-1">
            <AmountInput
              token={tokenIn}
              amount={amountIn}
              onAmountChange={handleAmountInChange}
              onTokenSelect={() => setSelecting(Selecting.In)}
              swapPla="出售"
              showMax
            />

            <AmountInput
              token={tokenOut}
              amount={amountOut}
              onAmountChange={handleAmountOutChange}
              onTokenSelect={() => setSelecting(Selecting.Out)}
              swapPla="购买"
            />
          </div>

          {/* Token 选择弹窗（只渲染一次，根据 selecting 状态决定开关） */}
          <TokenList
            tokens={tokenList}
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
            disabled={!amountIn || !amountOut || !isConnected || !isChainidMatch || isPending}
            className="w-full mt-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isConnected ? (isChainidMatch ? 'Swap' : 'Connect to Sepolia') : 'Connect wallet'}
          </button>
        </div>
      </div>
    </div>
  );
};
