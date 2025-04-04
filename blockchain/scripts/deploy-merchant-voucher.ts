import hre from 'hardhat';

async function main() {
  const signers = await hre.ethers.getSigners();
  const signer = signers[0];

  await hre.mbDeployer.setup();

  // 部署MerchantCertificationToken合约
  const merchantCert = await hre.mbDeployer.deploy(
    signer,
    'MerchantCertificationToken',
    [
      'TaipeiMerchantCert', // name
      'TMC', // symbol
      await signer.getAddress(), // initialOwner
    ],
    {
      addressAlias: 'merchant_certification',
      contractVersion: '1.0',
      contractLabel: 'merchant_certification',
    },
  );

  console.log(`MerchantCertificationToken deployed to ${await merchantCert.contract.getAddress()}`);

  // 部署VoucherToken合约
  const voucher = await hre.mbDeployer.deploy(
    signer,
    'VoucherToken',
    [
      await merchantCert.contract.getAddress(), // merchantCertificationAddress
    ],
    {
      addressAlias: 'voucher_token',
      contractVersion: '1.0',
      contractLabel: 'voucher_token',
    },
  );

  console.log(`VoucherToken deployed to ${await voucher.contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
