"use client";
import type { PostMethodArgs, MethodCallResponse, TransactionToSignResponse, Event } from "@curvegrid/multibaas-sdk";
import type { SendTransactionParameters } from "@wagmi/core";
import { Configuration, ContractsApi, EventsApi, ChainsApi } from "@curvegrid/multibaas-sdk";
import { useAccount } from "wagmi";
import { useCallback, useMemo } from "react";

// 定义商户认证接口
interface MerchantCertHook {
  mintCertification: (to: string, merchantTypeId: number, expirationTime: number) => Promise<SendTransactionParameters>;
  isExpired: (tokenId: number) => Promise<boolean | null>;
  revokeCertification: (tokenId: number) => Promise<SendTransactionParameters>;
  merchantTypeId: (tokenId: number) => Promise<number | null>;
  expirationTime: (tokenId: number) => Promise<number | null>;
  ownerOf: (tokenId: number) => Promise<string | null>;
  getMintEvents: (limit?: number) => Promise<Array<Event> | null>;
}

// 定义代金券接口
interface VoucherHook {
  defineVoucherType: (
    tokenId: number, 
    expiry: number, 
    maxUsage: number, 
    singleUsageLimit: number, 
    allowedMerchantTypes: number[]
  ) => Promise<SendTransactionParameters>;
  mintVoucher: (to: string, tokenId: number, amount: number) => Promise<SendTransactionParameters>;
  useVoucher: (tokenId: number, usageAmount: number, merchant: string, merchantCertTokenId: number) => Promise<SendTransactionParameters>;
  deposit: () => Promise<SendTransactionParameters>;
  withdraw: (to: string, amount: number) => Promise<SendTransactionParameters>;
  voucherAttributes: (tokenId: number) => Promise<any | null>;
  balanceOf: (owner: string, tokenId: number) => Promise<number | null>;
  consumptionCount: (user: string, tokenId: number) => Promise<number | null>;
  mintClaimableVoucher: (tokenId: number, amount: number, claimLimit: number) => Promise<SendTransactionParameters>;
  getClaimableVouchers: () => Promise<Array<{
    tokenId: number;
    claimLimit: number;
    availableAmount: number;
  }> | null>;
  claimVoucher: (tokenId: number) => Promise<SendTransactionParameters>;
  getVoucherDefinedEvents: (limit?: number) => Promise<Array<Event> | null>;
  getVoucherMintedEvents: (limit?: number) => Promise<Array<Event> | null>;
  getVoucherUsedEvents: (limit?: number) => Promise<Array<Event> | null>;
  getVoucherClaimedEvents: (limit?: number) => Promise<Array<Event> | null>;
}

interface MultiBaasHook {
  getChainStatus: () => Promise<{chainID: number, blockNumber: number} | null>;
  merchant: MerchantCertHook;
  voucher: VoucherHook;
  getDeployer: () => Promise<string | null>;
  getMerchants: () => Promise<string[]>;
}

const useMultiBaas = (): MultiBaasHook => {
  const mbBaseUrl = process.env.NEXT_PUBLIC_MULTIBAAS_DEPLOYMENT_URL || "";
  const mbApiKey = process.env.NEXT_PUBLIC_MULTIBAAS_DAPP_USER_API_KEY || "";
  
  // 使用新的合约标签和别名
  const merchantContractLabel = "merchant_certification";
  const merchantAddressAlias = "merchant_certification";
  const voucherContractLabel = "voucher_token";
  const voucherAddressAlias = "voucher_token";

  const chain = "ethereum";

  const mbConfig = useMemo(() => {
    return new Configuration({
      basePath: new URL("/api/v0", mbBaseUrl).toString(),
      accessToken: mbApiKey,
    });
  }, [mbBaseUrl, mbApiKey]);

  const contractsApi = useMemo(() => new ContractsApi(mbConfig), [mbConfig]);
  const eventsApi = useMemo(() => new EventsApi(mbConfig), [mbConfig]);
  const chainsApi = useMemo(() => new ChainsApi(mbConfig), [mbConfig]);

  const { address, isConnected } = useAccount();

  const getChainStatus = async () => {
    try {
      const response = await chainsApi.getChainStatus(chain);
      return response.data.result as {chainID: number, blockNumber: number};
    } catch (err) {
      console.error("Error getting chain status:", err);
      return null;
    }
  };

  // 通用合约调用函数
  const callContractFunction = useCallback(
    async (
      contractLabel: string, 
      addressAlias: string, 
      methodName: string, 
      args: PostMethodArgs['args'] = []
    ): Promise<MethodCallResponse['output'] | TransactionToSignResponse['tx']> => {
      const payload: PostMethodArgs = {
        args,
        contractOverride: true,
        ...(isConnected && address ? { from: address } : {}),
      };

      const response = await contractsApi.callContractFunction(
        chain,
        addressAlias,
        contractLabel,
        methodName,
        payload
      );

      if (response.data.result.kind === "MethodCallResponse") {
        return response.data.result.output;
      } else if (response.data.result.kind === "TransactionToSignResponse") {
        return response.data.result.tx;
      } else {
        throw new Error(`Unexpected response type: ${response.data.result.kind}`);
      }
    },
    [contractsApi, chain, isConnected, address]
  );

  // 商户认证相关函数
  const merchant: MerchantCertHook = {
    mintCertification: useCallback(
      async (to: string, merchantTypeId: number, expirationTime: number): Promise<SendTransactionParameters> => {
        return await callContractFunction(
          merchantContractLabel, 
          merchantAddressAlias, 
          "mintCertification", 
          [to, merchantTypeId, expirationTime]
        );
      }, 
      [callContractFunction, merchantContractLabel, merchantAddressAlias]
    ),
    
    isExpired: useCallback(
      async (tokenId: number): Promise<boolean | null> => {
        try {
          const result = await callContractFunction(
            merchantContractLabel, 
            merchantAddressAlias, 
            "isExpired", 
            [tokenId]
          );
          return result as boolean;
        } catch (err) {
          console.error("Error checking if token is expired:", err);
          return null;
        }
      },
      [callContractFunction, merchantContractLabel, merchantAddressAlias]
    ),
    
    revokeCertification: useCallback(
      async (tokenId: number): Promise<SendTransactionParameters> => {
        return await callContractFunction(
          merchantContractLabel, 
          merchantAddressAlias, 
          "revokeCertification", 
          [tokenId]
        );
      },
      [callContractFunction, merchantContractLabel, merchantAddressAlias]
    ),
    
    merchantTypeId: useCallback(
      async (tokenId: number): Promise<number | null> => {
        try {
          const result = await callContractFunction(
            merchantContractLabel, 
            merchantAddressAlias, 
            "merchantTypeId", 
            [tokenId]
          );
          return Number(result);
        } catch (err) {
          console.error("Error getting merchant type ID:", err);
          return null;
        }
      },
      [callContractFunction, merchantContractLabel, merchantAddressAlias]
    ),
    
    expirationTime: useCallback(
      async (tokenId: number): Promise<number | null> => {
        try {
          const result = await callContractFunction(
            merchantContractLabel, 
            merchantAddressAlias, 
            "expirationTime", 
            [tokenId]
          );
          return Number(result);
        } catch (err) {
          console.error("Error getting expiration time:", err);
          return null;
        }
      },
      [callContractFunction, merchantContractLabel, merchantAddressAlias]
    ),
    
    ownerOf: useCallback(
      async (tokenId: number): Promise<string | null> => {
        try {
          const result = await callContractFunction(
            merchantContractLabel, 
            merchantAddressAlias, 
            "ownerOf", 
            [tokenId]
          );
          return result as string;
        } catch (err) {
          console.error("Error getting token owner:", err);
          return null;
        }
      },
      [callContractFunction, merchantContractLabel, merchantAddressAlias]
    ),
    
    getMintEvents: useCallback(
      async (limit = 50): Promise<Array<Event> | null> => {
        try {
          // Transfer 事件在 ERC721 中用于记录铸造 (_from = 0x0)
          const eventSignature = "Transfer(address,address,uint256)";
          const response = await eventsApi.listEvents(
            undefined, // fromBlock
            undefined, // toBlock
            undefined, // fromAddress
            undefined, // toAddress
            undefined, // fromTransaction
            false, // includeInternal
            chain,
            merchantAddressAlias,
            merchantContractLabel,
            eventSignature,
            limit
          );
          
          return response.data.result;
        } catch (err) {
          console.error("Error getting mint events:", err);
          return null;
        }
      },
      [eventsApi, chain, merchantAddressAlias, merchantContractLabel]
    ),
  };

  // 代金券相关函数
  const voucher: VoucherHook = {
    defineVoucherType: useCallback(
      async (
        tokenId: number, 
        expiry: number, 
        maxUsage: number, 
        singleUsageLimit: number, 
        allowedMerchantTypes: number[]
      ): Promise<SendTransactionParameters> => {
        return await callContractFunction(
          voucherContractLabel, 
          voucherAddressAlias, 
          "defineVoucherType", 
          [tokenId, expiry, maxUsage, singleUsageLimit, allowedMerchantTypes]
        );
      },
      [callContractFunction, voucherContractLabel, voucherAddressAlias]
    ),
    
    mintVoucher: useCallback(
      async (to: string, tokenId: number, amount: number): Promise<SendTransactionParameters> => {
        return await callContractFunction(
          voucherContractLabel, 
          voucherAddressAlias, 
          "mintVoucher", 
          [to, tokenId, amount, "0x"]
        );
      },
      [callContractFunction, voucherContractLabel, voucherAddressAlias]
    ),
    
    useVoucher: useCallback(
      async (
        tokenId: number, 
        usageAmount: number, 
        merchant: string, 
        merchantCertTokenId: number
      ): Promise<SendTransactionParameters> => {
        return await callContractFunction(
          voucherContractLabel, 
          voucherAddressAlias, 
          "useVoucher", 
          [tokenId, usageAmount, merchant, merchantCertTokenId]
        );
      },
      [callContractFunction, voucherContractLabel, voucherAddressAlias]
    ),
    
    deposit: useCallback(
      async (): Promise<SendTransactionParameters> => {
        return await callContractFunction(voucherContractLabel, voucherAddressAlias, "deposit");
      },
      [callContractFunction, voucherContractLabel, voucherAddressAlias]
    ),
    
    withdraw: useCallback(
      async (to: string, amount: number): Promise<SendTransactionParameters> => {
        return await callContractFunction(
          voucherContractLabel, 
          voucherAddressAlias, 
          "withdraw", 
          [to, amount]
        );
      },
      [callContractFunction, voucherContractLabel, voucherAddressAlias]
    ),
    
    voucherAttributes: useCallback(
      async (tokenId: number): Promise<any | null> => {
        try {
          const result = await callContractFunction(
            voucherContractLabel, 
            voucherAddressAlias, 
            "voucherAttributes", 
            [tokenId]
          );
          return result;
        } catch (err) {
          console.error("Error getting voucher attributes:", err);
          return null;
        }
      },
      [callContractFunction, voucherContractLabel, voucherAddressAlias]
    ),
    
    balanceOf: useCallback(
      async (owner: string, tokenId: number): Promise<number | null> => {
        try {
          const result = await callContractFunction(
            voucherContractLabel, 
            voucherAddressAlias, 
            "balanceOf", 
            [owner, tokenId]
          );
          return Number(result);
        } catch (err) {
          console.error("Error getting balance:", err);
          return null;
        }
      },
      [callContractFunction, voucherContractLabel, voucherAddressAlias]
    ),
    
    consumptionCount: useCallback(
      async (user: string, tokenId: number): Promise<number | null> => {
        try {
          const result = await callContractFunction(
            voucherContractLabel, 
            voucherAddressAlias, 
            "consumptionCount", 
            [user, tokenId]
          );
          return Number(result);
        } catch (err) {
          console.error("Error getting consumption count:", err);
          return null;
        }
      },
      [callContractFunction, voucherContractLabel, voucherAddressAlias]
    ),
    
    getVoucherDefinedEvents: useCallback(
      async (limit = 50): Promise<Array<Event> | null> => {
        try {
          const eventSignature = "VoucherTypeDefined(uint256,uint256,uint256,uint256,uint256[])";
          const response = await eventsApi.listEvents(
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            chain,
            voucherAddressAlias,
            voucherContractLabel,
            eventSignature,
            limit
          );
          return response.data.result;
        } catch (err) {
          console.error("Error getting voucher defined events:", err);
          return null;
        }
      },
      [eventsApi, chain, voucherAddressAlias, voucherContractLabel]
    ),
    
    getVoucherMintedEvents: useCallback(
      async (limit = 50): Promise<Array<Event> | null> => {
        try {
          const eventSignature = "VoucherMinted(uint256,address,uint256)";
          const response = await eventsApi.listEvents(
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            chain,
            voucherAddressAlias,
            voucherContractLabel,
            eventSignature,
            limit
          );
          return response.data.result;
        } catch (err) {
          console.error("Error getting voucher minted events:", err);
          return null;
        }
      },
      [eventsApi, chain, voucherAddressAlias, voucherContractLabel]
    ),
    
    getVoucherUsedEvents: useCallback(
      async (limit = 50): Promise<Array<Event> | null> => {
        try {
          const eventSignature = "VoucherUsed(address,address,uint256,uint256)";
          const response = await eventsApi.listEvents(
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            chain,
            voucherAddressAlias,
            voucherContractLabel,
            eventSignature,
            limit
          );
          return response.data.result;
        } catch (err) {
          console.error("Error getting voucher used events:", err);
          return null;
        }
      },
      [eventsApi, chain, voucherAddressAlias, voucherContractLabel]
    ),

    // 新增方法实现
    mintClaimableVoucher: useCallback(
      async (tokenId: number, amount: number, claimLimit: number): Promise<SendTransactionParameters> => {
        return await callContractFunction(
          voucherContractLabel,
          voucherAddressAlias,
          "mintClaimableVoucher",
          [tokenId, amount, claimLimit, "0x"]
        );
      },
      [callContractFunction, voucherContractLabel, voucherAddressAlias]
    ),

    getClaimableVouchers: useCallback(
      async () => {
        try {
          const result = await callContractFunction(
            voucherContractLabel,
            voucherAddressAlias,
            "getClaimableVouchers",
            []
          );
          return result as Array<{
            tokenId: number;
            claimLimit: number;
            availableAmount: number;
          }>;
        } catch (err) {
          console.error("Error getting claimable vouchers:", err);
          return null;
        }
      },
      [callContractFunction, voucherContractLabel, voucherAddressAlias]
    ),

    claimVoucher: useCallback(
      async (tokenId: number): Promise<SendTransactionParameters> => {
        return await callContractFunction(
          voucherContractLabel,
          voucherAddressAlias,
          "claimVoucher",
          [tokenId, "0x"]
        );
      },
      [callContractFunction, voucherContractLabel, voucherAddressAlias]
    ),

    getVoucherClaimedEvents: useCallback(
      async (limit = 50): Promise<Array<Event> | null> => {
        try {
          const eventSignature = "VoucherClaimed(uint256,address,uint256)";
          const response = await eventsApi.listEvents(
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            chain,
            voucherAddressAlias,
            voucherContractLabel,
            eventSignature,
            limit
          );
          return response.data.result;
        } catch (err) {
          console.error("Error getting voucher claimed events:", err);
          return null;
        }
      },
      [eventsApi, chain, voucherAddressAlias, voucherContractLabel]
    ),
  };

  const getDeployer = async (): Promise<string | null> => {
    try {
      const events = await merchant.getMintEvents(20); // 获取更多事件以确保能找到第一个铸造事件
      if (events && events.length > 0) {
        // 查找第一个铸造事件（from 地址为 0x0）
        const firstMintEvent = events.find(event => 
          event.event.name === "Transfer" && 
          event.event.inputs.some(input => 
            input.name === "from" && 
            input.value === "0x0000000000000000000000000000000000000000"
          )
        );
        
        if (firstMintEvent) {
          return firstMintEvent.transaction.from;
        }
      }
      return null;
    } catch (error) {
      console.error("Error getting deployer:", error);
      return null;
    }
  };

  const getMerchants = async (): Promise<string[]> => {
    try {
      const events = await merchant.getMintEvents(20); // 获取足够多的事件以确保找到所有商户
      if (events && events.length > 0) {
        // 获取所有铸造事件中的 to 地址（商户地址）
        const merchantAddresses = events
          .filter(event => 
            event.event.name === "Transfer" && 
            event.event.inputs.some(input => 
              input.name === "from" && 
              input.value === "0x0000000000000000000000000000000000000000"
            )
          )
          .map(event => {
            const toInput = event.event.inputs.find(input => input.name === "to");
            return toInput ? toInput.value : null;
          })
          .filter((address): address is string => address !== null);

        // 去重并返回
        return Array.from(new Set(merchantAddresses));
      }
      return [];
    } catch (error) {
      console.error("Error getting merchants:", error);
      return [];
    }
  };

  return {
    getChainStatus,
    merchant,
    voucher,
    getDeployer,
    getMerchants,
  };
};

export default useMultiBaas;
