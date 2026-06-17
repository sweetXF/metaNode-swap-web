import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { fallback, http } from 'wagmi';

const projectId = import.meta.env.VITE_WC_PROJECT_ID;
const rpcUrl = import.meta.env.VITE_INFURA_RPC_URL;

if (!projectId) throw new Error('Missing VITE_WC_PROJECT_ID');

export const wagmiConfig = getDefaultConfig({
  appName: 'MetaNodeSwap',
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: fallback([
      http(rpcUrl, {
        batch: true, // 合并并发请求
        retryCount: 3, // 429/失败自动重试
        retryDelay: 300, // 退避起步 300ms
      }),
      http('https://ethereum-sepolia-rpc.publicnode.com'), // 公共备用RPC
      http(), // 链默认公共 RPC 兜底
    ]),
  },
  ssr: false,
});
