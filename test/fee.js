const { ethers } = require('ethers');
const assert = require('assert');
const { compile } = require('../lib/solc_util')
const { deploy } = require('../lib/solc_util')
const { parseReturnedDataWithLogs } = require('../lib/parse_util')

const RPC = process.env.RPC || "http://localhost:9650/ext/bc/C/rpc"
const provider = new ethers.providers.JsonRpcProvider({ url: RPC, timeout: 6000 })
const wallet = new ethers.Wallet("0x56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027", provider)
const nocoin = new ethers.Wallet("0x0000000000000000000000000000000000000000000000000000000000000001", provider)
const from = "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"
const EVMPP = "0x5555555555555555555555555555555555555555"
const callLogsAccessList = [{
    address: "0x5555555555555555555555555555555555555555",
    storageKeys: [ "0x5555555555555555555555555555555555555555555555555555555555555555" ],
}]


describe('Fee Payer', function () {
    it('tx fee payed', async function () {
        const chainId = (await provider.getNetwork()).chainId
        const gasPrice = await provider.getGasPrice()
        const nonce = await nocoin.getTransactionCount('pending')

        const tx = {
            chainId,
            to: '0x1234567890123456789012345678901234567890',   // dummy address
            gasLimit: 21000,
            gasPrice,
            nonce,
        }

        const rawSignedTx = await nocoin.signTransaction(tx)

        try {
            await provider.sendTransaction(rawSignedTx) 
        } catch(err) {
            assert.equal(err?.reason, 'insufficient funds for intrinsic transaction cost')
        }

        const result = compile(`
            function call(
                address to,
                bytes calldata data,
                uint256 r,      // signature V
                uint256 s,      // signature R
                uint256 v       // signature S
            ) external {}
        `)

        const walletNonce = await wallet.getTransactionCount('pending')
        const c = new ethers.Contract(EVMPP, result.abi, wallet)
        const t = ethers.utils.parseTransaction(rawSignedTx)

        const res = await c.call(
            t.to,
            t.data,
            0,
            t.v, t.r, t.s, {
                gasPrice,
            },
        )

        assert.equal(await wallet.getTransactionCount('pending'), walletNonce + 1, "fee payer nonce must be increased")
        assert.equal(await nocoin.getTransactionCount('pending'), nonce + 1, "fee payee nonce must be increased")
    });
});
