"use client";

import React from 'react';

interface VoucherTooltipProps {
  data: {
    tokenId: number;
    expiry?: string;
    maxUsage?: number;
    singleUsageLimit?: string;
    allowedMerchantTypes?: number[];
  };
  children: React.ReactNode;
}

const VoucherTooltip: React.FC<VoucherTooltipProps> = ({ data, children }) => {
  return (
    <div className="relative group inline-block">
      <div className="cursor-pointer underline decoration-dotted">
        {children}
      </div>
      <div className="absolute z-10 invisible group-hover:visible bg-white border border-gray-200 rounded-md shadow-lg p-3 min-w-64 text-sm left-0 mt-1">
        <div className="font-semibold mb-1 border-b pb-1">代金券详情 (ID: {data.tokenId})</div>
        <table className="w-full text-xs">
          <tbody>
            {data.expiry && (
              <tr>
                <td className="pr-2 py-1 font-medium">过期时间:</td>
                <td>{data.expiry}</td>
              </tr>
            )}
            {data.maxUsage !== undefined && (
              <tr>
                <td className="pr-2 py-1 font-medium">最大使用次数:</td>
                <td>{data.maxUsage}</td>
              </tr>
            )}
            {data.singleUsageLimit && (
              <tr>
                <td className="pr-2 py-1 font-medium">单次限额:</td>
                <td>{data.singleUsageLimit} wei</td>
              </tr>
            )}
            {data.allowedMerchantTypes && data.allowedMerchantTypes.length > 0 && (
              <tr>
                <td className="pr-2 py-1 font-medium">允许商户类型:</td>
                <td>{data.allowedMerchantTypes.join(', ')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VoucherTooltip;