const { ethers } = require('ethers');
const assert = require('assert');
const { getWallet } = require('../lib/accounts')
const { deploy } = require('../lib/solc_util')
const { createEVMPP } = require('../lib/evmpp')

const RPC = process.env.RPC || "http://localhost:9650/ext/bc/C/rpc"
const provider = new ethers.providers.JsonRpcProvider(RPC)
const nocoin = new ethers.Wallet.createRandom().connect(provider)
const dummy = new ethers.Wallet.createRandom()


const EVMPP = createEVMPP(provider, {
    returns: {
        payFor: 'bytes[] memory results',
        callBatch: 'bytes[] memory results',
        sponsor: 'bytes[] memory results'
    },

})

function assertApprox(x, y, msg, tolerant = 0.1) {
    assert(x >= y * (1 - tolerant), msg + ': too low')
    assert(x <= y * (1 + tolerant), msg + ': too high')
}

describe('Sponsor', function () {
    let wallet
    let evmpp
    let chainId
    before(async () => {
        [wallet, { chainId }] = await Promise.all([
            getWallet(__filename, provider),
            provider.getNetwork(),
        ])
        evmpp = EVMPP.connect(wallet);
    })

    it('legacy tx sponsor payed', async function () {
        await assert.rejects(
            nocoin.sendTransaction({ to: dummy.address, gasLimit: 21000, }),
            { reason: 'insufficient funds for intrinsic transaction cost' },
        )

        const [nonce, walletNonce] = await Promise.all([
            nocoin.getTransactionCount('pending'),
            wallet.getTransactionCount('pending'),
        ])

        const tx = {
            chainId,
            to: dummy.address,
            gasLimit: 21000,
            gasPrice: 0,
            nonce,
            type: 0
        }

        const txReq = await nocoin.populateTransaction(tx)
        const rawSignedTx = await nocoin.signTransaction(txReq)

        const res = await evmpp.sponsor(rawSignedTx);

        const receipt = await res.wait(1);
        assert(receipt.gasUsed.gt(21000 * 2), 'double intrinsic gas')

        const [a, b] = await Promise.all([
            wallet.getTransactionCount('pending'),
            nocoin.getTransactionCount('pending'),
        ])

        assert.equal(a, walletNonce + 1, "fee payer nonce must be increased")
        assert.equal(b, nonce + 1, "fee payee nonce must be increased")

        await assert.rejects(evmpp.callStatic.sponsor(
            rawSignedTx
        ), { reason: 'payee: invalid nonce' }, 'payee tx replayed')
    });


    it('AccessList tx sponsor payed', async function () {
        await assert.rejects(
            nocoin.sendTransaction({ to: dummy.address, gasLimit: 21000, }),
            { reason: 'insufficient funds for intrinsic transaction cost' },
        )

        const [nonce, walletNonce] = await Promise.all([
            nocoin.getTransactionCount('pending'),
            wallet.getTransactionCount('pending'),
        ])

        const tx = {
            chainId,
            to: dummy.address,
            gasLimit: 21000,
            gasPrice: 0,
            nonce,
            type: 1
        }

        const txReq = await nocoin.populateTransaction(tx)
        const rawSignedTx = await nocoin.signTransaction(txReq)

        const res = await evmpp.sponsor(rawSignedTx);

        const receipt = await res.wait(1);
        assert(receipt.gasUsed.gt(21000 * 2), 'double intrinsic gas')

        const [a, b] = await Promise.all([
            wallet.getTransactionCount('pending'),
            nocoin.getTransactionCount('pending'),
        ])

        assert.equal(a, walletNonce + 1, "fee payer nonce must be increased")
        assert.equal(b, nonce + 1, "fee payee nonce must be increased")

        await assert.rejects(evmpp.callStatic.sponsor(
            rawSignedTx
        ), { reason: 'payee: invalid nonce' }, 'payee tx replayed')
    });

    it('Dynamic Fee tx sponsor payed', async function () {
        await assert.rejects(
            nocoin.sendTransaction({ to: dummy.address, gasLimit: 21000, }),
            { reason: 'insufficient funds for intrinsic transaction cost' },
        )

        const [nonce, walletNonce] = await Promise.all([
            nocoin.getTransactionCount('pending'),
            wallet.getTransactionCount('pending'),
        ])

        const tx = {
            chainId,
            to: dummy.address,
            gasLimit: 21000,
            // gasPrice: 0,
            maxFeePerGas: 0,
            nonce,
            type: 2
        }

        const txReq = await nocoin.populateTransaction(tx)
        const rawSignedTx = await nocoin.signTransaction(txReq)

        const res = await evmpp.sponsor(rawSignedTx);

        const receipt = await res.wait(1);
        assert(receipt.gasUsed.gt(21000 * 2), 'double intrinsic gas')

        const [a, b] = await Promise.all([
            wallet.getTransactionCount('pending'),
            nocoin.getTransactionCount('pending'),
        ])

        assert.equal(a, walletNonce + 1, "fee payer nonce must be increased")
        assert.equal(b, nonce + 1, "fee payee nonce must be increased")

        await assert.rejects(evmpp.callStatic.sponsor(
            rawSignedTx
        ), { reason: 'payee: invalid nonce' }, 'payee tx replayed')
    });



    it('payee: invalid nonce', async function () {
        const [nonce] = await Promise.all([
            nocoin.getTransactionCount('pending'),
        ])

        const tx = {
            chainId,
            to: dummy.address,
            gasLimit: 21000,
            gasPrice: 0,
            nonce: nonce + 1,
        }

        const rawSignedTx = await nocoin.signTransaction(tx)

        await assert.rejects(evmpp.callStatic.sponsor(
            rawSignedTx
        ), { reason: 'payee: invalid nonce' })
    });


    describe('incorrect payee signature', function () {
        const to = dummy.address

        it('invalid signature', async function () {
            nonce = await nocoin.getTransactionCount('pending')

            const tx = {
                chainId,
                to: to,
                gasLimit: 21000,
                gasPrice: 0,
                nonce,
            }

            let rawSignedTx = await nocoin.signTransaction(tx)
            const t = ethers.utils.parseTransaction(rawSignedTx)

            await assert.rejects(evmpp.callStatic.sponsor(
                '0xf85f04808252089436513d11fd1dd36a970b84852ff1fd663748d9a5808080a00d692d1406e03d745274ec0b5e1679b4b7dd22a07b7a039a4d376879f24d5a38a0105784b63e39906b45b31e708eda0a3b9e9492f92267fe13b094033f98665e56'
            ), { reason: 'payee: invalid signature' }, 'invalid V')

            await assert.rejects(evmpp.callStatic.sponsor(
                '0xf84104808252089436513d11fd1dd36a970b84852ff1fd663748d9a5808082148d80a0105784b63e39906b45b31e708eda0a3b9e9492f92267fe13b094033f98665e56'
            ), { reason: 'payee: invalid signature' }, 'invalid R')

            await assert.rejects(evmpp.callStatic.sponsor(
                '0xf84104808252089436513d11fd1dd36a970b84852ff1fd663748d9a5808082148da00d692d1406e03d745274ec0b5e1679b4b7dd22a07b7a039a4d376879f24d5a3880'
            ), { reason: 'payee: invalid signature' }, 'invalid S')
        });

        it('incorrect signature', async function () {
            nonce = await nocoin.getTransactionCount('pending')

            const tx = {
                chainId,
                to: to,
                gasLimit: 21000,
                gasPrice: 0,
                nonce,
            }

            const rawSignedTx = await nocoin.signTransaction(tx)

            await evmpp.sponsor(rawSignedTx)

            assert.equal(await nocoin.getTransactionCount('pending'), nonce, "fee payee nonce must not be increased")
        });

    });


    it('balance change', async function () {
        const [nonce, balanceBefore, payerBalance, receiverBalance] = await Promise.all([
            nocoin.getTransactionCount('pending'),
            provider.getBalance(nocoin.address),
            provider.getBalance(wallet.address),
            provider.getBalance(dummy.address),
        ])

        const tx = {
            chainId,
            to: dummy.address,
            gasLimit: 21000,
            gasPrice: 0,
            nonce,
        }

        const rawSignedTx = await nocoin.signTransaction(tx)

        const res = await evmpp.connect(wallet).sponsor(rawSignedTx,
            { value: ethers.utils.parseEther('30'), gasLimit: 100000 })

        const receipt = await res.wait(1);
        assert(receipt.gasUsed.gt(21000 * 2), 'double intrinsic gas')

        const balanceAfter = await provider.getBalance(await nocoin.getAddress());
        assert(balanceBefore.eq(balanceAfter), "payee balance must be unchanged");

        const payerBalanceAfter = await provider.getBalance(wallet.address);
        assert(payerBalance.sub(payerBalanceAfter).gt(ethers.utils.parseEther('30')), "payer balance must be decreased");

        const receiverBalanceAfter = await provider.getBalance(dummy.address);
        assert(receiverBalanceAfter.sub(receiverBalance).eq(ethers.utils.parseEther('30')), "receiver balance must be increased");
    });


    describe('Batch Tx', function () {
        const txs = [
            {
                to: '0x7dcA4B509c9F5296264d615147581c36db81A3f8',
                value: ethers.utils.parseEther('1'),
                data: ethers.utils.arrayify('0x')
            },
            {
                to: '0x348145b162bE7865Dd32DADF3C2E193dc1450489',
                value: ethers.utils.parseEther('2'),
                data: ethers.utils.arrayify('0x')
            },
            {
                to: '0xBEa3eF61735cb5d48112DB218eACF95bb9cA4D2C',
                value: ethers.utils.parseEther('3'),
                data: ethers.utils.arrayify('0x')
            }
        ]

        it('nonce', async function () {
            const nonce = await nocoin.getTransactionCount('pending')

            const tx = {
                chainId,
                to: evmpp.address,
                gasLimit: 30000,
                gasPrice: 0,
                nonce,
                data: evmpp.interface.encodeFunctionData("callBatch", [txs])
            }

            const rawSignedTx = await nocoin.signTransaction(tx)

            const walletNonce = await wallet.getTransactionCount('pending')

            const res = await evmpp.sponsor(rawSignedTx, { value: ethers.utils.parseEther('30') });

            const receipt = await res.wait(1);
            assert(receipt.gasUsed.gt(21000 * 2), 'double intrinsic gas')

            assert.equal(await wallet.getTransactionCount('pending'), walletNonce + 1, "fee payer nonce must be increased")
            assert.equal(await nocoin.getTransactionCount('pending'), nonce + 1, "fee payee nonce must be increased")

            await assert.rejects(evmpp.callStatic.sponsor(rawSignedTx
            ), { reason: 'payee: invalid nonce' }, 'payee replay protection')
        });



        it('balance', async function () {
            const nonce = await nocoin.getTransactionCount('pending')

            const tx = await evmpp.connect(nocoin).populateTransaction.callBatch(txs, { gasLimit: 40000, nonce: nonce, gasPrice: 0 })

            const rawSignedTx = await nocoin.signTransaction(tx)
            const t = ethers.utils.parseTransaction(rawSignedTx)

            const balance1Before = await provider.getBalance("0x7dcA4B509c9F5296264d615147581c36db81A3f8");
            const balance2Before = await provider.getBalance("0x348145b162bE7865Dd32DADF3C2E193dc1450489");
            const balance3Before = await provider.getBalance("0xBEa3eF61735cb5d48112DB218eACF95bb9cA4D2C");

            const res = await evmpp.sponsor(rawSignedTx, { value: ethers.utils.parseEther('30') })
            const receipt = await res.wait(1);
            assert(receipt.gasUsed.gt(21000 * 2), 'double intrinsic gas')

            const balance1After = await provider.getBalance("0x7dcA4B509c9F5296264d615147581c36db81A3f8");
            const balance2After = await provider.getBalance("0x348145b162bE7865Dd32DADF3C2E193dc1450489");
            const balance3After = await provider.getBalance("0xBEa3eF61735cb5d48112DB218eACF95bb9cA4D2C");

            assert.equal(balance1After.sub(balance1Before).toString(), ethers.utils.parseEther('1').toString(), 'balance 1');
            assert.equal(balance2After.sub(balance2Before).toString(), ethers.utils.parseEther('2').toString(), 'balance 2');
            assert.equal(balance3After.sub(balance3Before).toString(), ethers.utils.parseEther('3').toString(), 'balance 3');
        });

    });


    describe('ERC20', function () {
        let erc20
        before(async () => {
            erc20 = await deploy('ERC20.sol', wallet, ethers.utils.parseUnits("100"))
            const r = await erc20.transfer(nocoin.address, "30")
            await r.wait(1)
        })

        it('transfer must be successfully', async function () {
            const [nonce] = await Promise.all([
                nocoin.getTransactionCount('pending'),
            ])

            const tx = {
                chainId,
                to: erc20.address,
                gasLimit: 60000,
                data: erc20.interface.encodeFunctionData("transfer", ["0x1234567890123456789012345678901234567890", 4]),
                gasPrice: 0,
                nonce,
            }

            const beforeBalance = await erc20.balanceOf(nocoin.address)

            const rawSignedTx = await nocoin.signTransaction(tx)

            const res = await evmpp.sponsor(rawSignedTx)

            const receipt = await res.wait(1);
            assert(receipt.gasUsed.gt(21000 * 2), 'double intrinsic gas')
            const afterBalance = await erc20.balanceOf(nocoin.address)

            assert.equal(beforeBalance.sub(afterBalance), 4, 'Balance must be decreased by 4')
        });



        it('transfer must be failed', async function () {
            const [nonce] = await Promise.all([
                nocoin.getTransactionCount('pending'),
            ])

            const tx = {
                chainId,
                to: erc20.address,
                gasLimit: 21000,
                data: erc20.interface.encodeFunctionData("transfer", ["0x1234567890123456789012345678901234567890", 4]),
                gasPrice: 0,
                nonce,
            }

            const rawSignedTx = await nocoin.signTransaction(tx)

            await assert.rejects(evmpp.callStatic.sponsor(rawSignedTx
            ), { reason: "payee: intrinsic gas too low" })
        });


        it('batch erc20', async function () {
            const txs = [
                {
                    to: erc20.address,
                    value: 0,
                    data: erc20.interface.encodeFunctionData("transfer", [wallet.address, 4]),
                },
                {
                    to: erc20.address,
                    value: 0,
                    data: erc20.interface.encodeFunctionData("transfer", ["0x202359E874C243012710Bd5e61db43b1f3F5c02c", 2]),
                },
                {
                    to: erc20.address,
                    value: 0,
                    data: erc20.interface.encodeFunctionData("transfer", ["0xf36fE0A7dB833798b743819803a91C7AeDDF3c43", 3]),
                }
            ]

            const gasLimit = await evmpp.connect(nocoin).estimateGas.callBatch(txs)
            assertApprox(gasLimit.toNumber(), 91712, 'payee batch tx gasLimit')

            const nonce = await nocoin.getTransactionCount('pending')
            const tx = await evmpp.connect(nocoin).populateTransaction.callBatch(txs, { gasLimit, nonce })

            const balanceBefore = await erc20.balanceOf(nocoin.address)
            const balance2Before = await erc20.balanceOf("0x202359E874C243012710Bd5e61db43b1f3F5c02c");
            const balance3Before = await erc20.balanceOf("0xf36fE0A7dB833798b743819803a91C7AeDDF3c43");

            const rawSignedTx = await nocoin.signTransaction(tx)

            const gas = await evmpp.estimateGas.sponsor(rawSignedTx)
            assertApprox(gas.toNumber(), 120172, 'payee batch tx gasLimit')

            const res = await evmpp.sponsor(rawSignedTx);

            receipt = await res.wait(1);
            assert.equal(receipt.gasUsed.toNumber(), gas.toNumber(), 'payer gas used')

            const balanceAfter = await erc20.balanceOf(nocoin.address)
            const balance2After = await erc20.balanceOf("0x202359E874C243012710Bd5e61db43b1f3F5c02c");
            const balance3After = await erc20.balanceOf("0xf36fE0A7dB833798b743819803a91C7AeDDF3c43");

            assert.equal(balanceBefore.sub(balanceAfter), 9, 'Balance must be decreased by 9')
            assert.equal(balance2After.sub(balance2Before), 2, 'Balance must be increased by 2');
            assert.equal(balance3After.sub(balance3Before), 3, 'Balance must be increased by 3');
        });

        it('payee: gas too low', async function () {
            const erc20 = await deploy('ERC20.sol', wallet, ethers.utils.parseUnits("100"))

            const [nonce] = await Promise.all([
                nocoin.getTransactionCount('pending'),
            ])

            const r = await erc20.transfer(nocoin.address, "10")
            const receipt = await r.wait(1);
            assert(receipt.gasUsed.gt(21000 * 2), 'double intrinsic gas')

            const tx = await erc20.connect(nocoin).populateTransaction.transfer('0x1234567890123456789012345678901234567890', 4, {
                gasLimit: 21000,
                gasPrice: 0,
                nonce: nonce
            });

            const rawSignedTx = await nocoin.signTransaction(tx)

            await assert.rejects(evmpp.callStatic.sponsor(rawSignedTx
            ), { reason: "payee: intrinsic gas too low" });

            await assert.rejects(evmpp.callStatic.sponsor(rawSignedTx,
                { gasLimit: 21000 * 2 },
            ), (err) => {
                const body = JSON.parse(err.error.body)
                assert.strictEqual(body.error.message, 'out of gas');
                return true;
            });

        });


    });


});
