const { ethers } = require('ethers');
const assert = require('assert');
const { compile } = require('../lib/solc_util')
const { getWallets } = require('../lib/accounts')
const { fundAccounts } = require('../lib/accounts')


const RPC = process.env.RPC || "http://localhost:9650/ext/bc/C/rpc"
const provider = new ethers.providers.JsonRpcProvider({ url: RPC, timeout: 6000 })
const wallet = new ethers.Wallet("0x56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027", provider)
const nocoin = new ethers.Wallet("0x0000000000000000000000000000000000000000000000000000000000000001", provider)
const from = "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"
const EVMPP = "0x5555555555555555555555555555555555555555"
const callLogsAccessList = [{
    address: "0x5555555555555555555555555555555555555555",
    storageKeys: ["0x5555555555555555555555555555555555555555555555555555555555555555"],
}]


var wallets = getWallets(provider);


before(async () => {
    await fundAccounts(wallet, wallets, "40000", provider);
})


const result = compile(`
    function call(
        address to,
        bytes calldata data,
        uint256 nonce,
        uint256 gasLimit,
        uint256 v,      // signature V
        uint256 r,      // signature R
        uint256 s       // signature S
    ) payable external {}`
)


describe('Fee Payer', function () {
    it('tx fee payed', async function () {
        const wallet = wallets.pop();
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
            // await provider.sendTransaction(rawSignedTx)
        } catch (err) {
            assert.equal(err?.reason, 'insufficient funds for intrinsic transaction cost')
        }

        const walletNonce = await wallet.getTransactionCount('pending')
        const c = new ethers.Contract(EVMPP, result.abi, wallet)
        const t = ethers.utils.parseTransaction(rawSignedTx)

        const res = await c.call(
            t.to,
            t.data,
            nonce,
            t.gasLimit,
            t.v, t.r, t.s, {
            gasPrice: gasPrice,
            value: ethers.utils.parseEther('30')
        },
        )
        receipt = await res.wait(1);

        assert.equal(await wallet.getTransactionCount('pending'), walletNonce + 1, "fee payer nonce must be increased")
        assert.equal(await nocoin.getTransactionCount('pending'), nonce + 1, "fee payee nonce must be increased")
    });


    describe('incorrect payee signature', function () {
        let tx, chainId, gasPrice;
        const to = '0x1234567890123456789012345678901234567890' // dummy address

        before(async function () {
            gasPrice = await provider.getGasPrice()
            chainId = (await provider.getNetwork()).chainId
        });


        it('incorrect V', async function () {
            const wallet = wallets.pop();
            nonce = await nocoin.getTransactionCount('pending')

            const tx = {
                chainId,
                to: to,
                gasLimit: 21000,
                gasPrice,
                nonce,
            }

            const rawSignedTx = await nocoin.signTransaction(tx)

            const c = new ethers.Contract(EVMPP, result.abi, wallet)
            const t = ethers.utils.parseTransaction(rawSignedTx)

            try {
                const res = await c.callStatic.call(
                    t.to,
                    t.data,
                    nonce,
                    t.gasLimit,
                    86262,
                    t.r,
                    t.s,
                    {
                        gasPrice: gasPrice,
                        value: ethers.utils.parseEther('30')
                    },
                )
                assert(false)

            } catch (err) {
                assert(err?.reason == 'invalid payee signature')
            }
        });


        it('incorrect R', async function () {
            nonce = await nocoin.getTransactionCount('pending')
            const wallet = wallets.pop();

            const tx = {
                chainId,
                to: to,
                gasLimit: 21000,
                gasPrice,
                nonce,
            }

            const rawSignedTx = await nocoin.signTransaction(tx)

            const c = new ethers.Contract(EVMPP, result.abi, wallet)
            const t = ethers.utils.parseTransaction(rawSignedTx)

            try {
                const res = await c.callStatic.call(
                    t.to,
                    t.data,
                    nonce,
                    t.gasLimit,
                    t.v,
                    '0xf7d936822d081caa6aeed1fda1abd731114f00544e5c8e5b5f35621916a7ba81',
                    t.s,
                    {
                        gasPrice: gasPrice,
                        value: ethers.utils.parseEther('30')
                    },
                )
                assert(false)

            } catch (err) {
                assert(err?.reason == 'invalid payee signature')
            }
        });



        it('incorrect S', async function () {
            const wallet = wallets.pop();
            nonce = await nocoin.getTransactionCount('pending')

            const tx = {
                chainId,
                to: to,
                gasLimit: 21000,
                gasPrice,
                nonce,
            }

            const rawSignedTx = await nocoin.signTransaction(tx)

            const c = new ethers.Contract(EVMPP, result.abi, wallet)
            const t = ethers.utils.parseTransaction(rawSignedTx)

            try {
                const res = await c.callStatic.call(
                    t.to,
                    t.data,
                    nonce,
                    t.gasLimit,
                    t.v,
                    t.r,
                    '0x46a768e02b8acce6a293edafca20523f67f520c700fc51ca353583f03a0d8c01',
                    {
                        gasPrice: gasPrice,
                        value: ethers.utils.parseEther('30')
                    },
                )
                assert(false)
            } catch (err) {
                assert(err?.reason == 'invalid payee signature')
            }
        });

    });


    describe('balance', function () {
        it('payee balance must be unchanged', async function () {
            const wallet = wallets.pop();

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

            const walletNonce = await wallet.getTransactionCount('latest')
            const c = new ethers.Contract(EVMPP, result.abi, wallet)
            const t = ethers.utils.parseTransaction(rawSignedTx)

            const balanceBefore = await provider.getBalance(await nocoin.getAddress());

            const res = await c.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                t.r,
                t.r,
                t.s, {
                gasPrice: gasPrice,
                value: ethers.utils.parseEther('30')
            },
            )

            receipt = await res.wait(1);
            const balanceAfter = await provider.getBalance(await nocoin.getAddress());

            assert(balanceBefore.eq(balanceAfter), "payee balance must be unchanged")
        });


        it('payee balance must be decreased', async function () {
            const wallet = wallets.pop();

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

            const c = new ethers.Contract(EVMPP, result.abi, wallet)
            const t = ethers.utils.parseTransaction(rawSignedTx)

            const balanceBefore = await provider.getBalance(await wallet.getAddress());

            const res = await c.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                t.r,
                t.r,
                t.s,
                {
                    gasPrice: gasPrice,
                    value: ethers.utils.parseEther('30')
                },
            )

            receipt = await res.wait(1);
            const balanceAfter = await provider.getBalance(await wallet.getAddress());

            assert(balanceBefore.gt(balanceAfter), "payer balance must be decreased")
        });

    });

});
