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


const wallets = getWallets(provider);


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
    before(async () => {
        await fundAccounts(wallet, wallets, "40000", provider);
    })
    
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


        it('invalid signature', async function () {
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

            await assert.rejects(c.callStatic.call(
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
            ), { reason: 'invalid payee signature' }, 'invalid V' )

            await assert.rejects(c.callStatic.call(
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
            ), { reason: 'invalid payee signature' }, 'invalid R' )

            await assert.rejects(c.callStatic.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                t.v,
                t.r,
                '0x0000000000000000000000000000000000000000000000000000000000000000',
                {
                    gasPrice: gasPrice,
                    value: ethers.utils.parseEther('30')
                },
            ), { reason: 'invalid payee signature' }, 'invalid S' )

            0x46a768e02b8acce6a293edafca20523f67f520c700fc51ca353583f03a0d8c01
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


    describe('Batch Tx', function () {
        let chainId, gasPrice;
        const batchTx = compile(`
        struct Tx {
            address to;
            bytes  data;
            uint256 value;	// ether value to transfer
        }
        function call(Tx[] calldata txs) external returns (bytes[] memory results) {}
    `)
        let iface = new ethers.utils.Interface(batchTx.abi)


        const txs = [
            {
                to: '0x232544a805249cCd5A81Dbb8c457F46fC24E7821',
                value: ethers.utils.parseEther('1'),
                data: ethers.utils.arrayify('0x')
            },
            {
                to: '0x202359E874C243012710Bd5e61db43b1f3F5c02c',
                value: ethers.utils.parseEther('2'),
                data: ethers.utils.arrayify('0x')
            },
            {
                to: '0xf36fE0A7dB833798b743819803a91C7AeDDF3c43',
                value: ethers.utils.parseEther('3'),
                data: ethers.utils.arrayify('0x')
            }
        ]

        before(async function () {
            chainId = (await provider.getNetwork()).chainId
            gasPrice = await provider.getGasPrice()
        });

        it('nonce', async function () {
            const wallet = wallets.pop();
            const nonce = await nocoin.getTransactionCount('pending')

            const tx = {
                chainId,
                to: EVMPP,
                gasLimit: 21000,
                gasPrice,
                nonce,
                data: iface.encodeFunctionData("call", [txs])
            }

            const rawSignedTx = await nocoin.signTransaction(tx)

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



        it('balance', async function () {
            const wallet = wallets.pop();
            const nonce = await nocoin.getTransactionCount('pending')

            const tx = {
                chainId,
                to: EVMPP,
                gasLimit: 21000,
                gasPrice,
                nonce,
                data: iface.encodeFunctionData("call", [txs])
            }

            const rawSignedTx = await nocoin.signTransaction(tx)
            const c = new ethers.Contract(EVMPP, result.abi, wallet)
            const t = ethers.utils.parseTransaction(rawSignedTx)

            const balance1Before = await provider.getBalance("0x232544a805249cCd5A81Dbb8c457F46fC24E7821");
            const balance2Before = await provider.getBalance("0x202359E874C243012710Bd5e61db43b1f3F5c02c");
            const balance3Before = await provider.getBalance("0xf36fE0A7dB833798b743819803a91C7AeDDF3c43");

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

            const balance1After = await provider.getBalance("0x232544a805249cCd5A81Dbb8c457F46fC24E7821");
            const balance2After = await provider.getBalance("0x202359E874C243012710Bd5e61db43b1f3F5c02c");
            const balance3After = await provider.getBalance("0xf36fE0A7dB833798b743819803a91C7AeDDF3c43");

            assert.equal(balance1After - balance1Before, ethers.utils.parseEther('1'));
            assert.equal(balance2After - balance2Before, ethers.utils.parseEther('2'));
            assert.equal(balance3After - balance3Before, ethers.utils.parseEther('3'));
        });

    });
});
