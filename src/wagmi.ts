import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import {http} from "wagmi"

const projectId=import.meta.env.VITE_WC_PROJECT_ID;
const rpcUrl = import.meta.env.VITE_INFURA_RPC_URL;

if (!projectId) throw new Error('Missing VITE_WC_PROJECT_ID');

export const wagmiConfig = getDefaultConfig({
    appName: "MetaNodeSwap",
    projectId,
    chains: [sepolia],
    transports: {
        [sepolia.id]: http(rpcUrl),
    },
    ssr: false,
});