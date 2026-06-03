import { sepolia } from "wagmi/chains";

export const CONTRACTS={
    [sepolia.id]:{  // sepolia.id = 11155111
        PoolManager : '0xddC12b3F9F7C91C79DA7433D8d212FB78d609f7B',
        PositionManager : '0xbe766Bf20eFfe431829C5d5a2744865974A0B610',
        SwapRouter : '0xD2c220143F5784b3bD84ae12747d97C8A36CeCB2',
    }
} as const;

/** 通过链 ID 取合约地址（带类型提示） */
export type ContractName = keyof typeof CONTRACTS[typeof sepolia.id];

export const getContractAddress = (chainId: number, contractName: ContractName) => {
    const addresses=CONTRACTS[chainId as keyof typeof CONTRACTS];
    if (!addresses) throw new Error(`Unsupported chain: ${chainId}`)
    return addresses[contractName] as `0x${string}`;
};