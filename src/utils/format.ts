import { formatUnits } from "viem";

// 短地址展示
export const shortAddress = (address?:string,head=4,tail=4) => {
    if (!address) return "-";
    if(address.length<=head+tail) return address;
    return address.slice(0, head) + '...' + address.slice(-tail);
}

//把 bigint（带 decimals）格式化为人类可读字符串
export const formatBigInt = (value:bigint | undefined,decimals=18,fractionDigits=2):string => {
    if (!value) return "-";
    const num = Number(formatUnits(value,decimals));
    return num.toFixed(fractionDigits);
}