const { ethers } = require('ethers');
const assert = require('assert');
const { compile } = require('../lib/solc_util')
const { getWallet } = require('../lib/accounts')
const { deploy } = require('../lib/solc_util')


const RPC = process.env.RPC || "http://localhost:9650/ext/bc/C/rpc"
const provider = new ethers.providers.JsonRpcProvider(RPC)
const nocoin = new ethers.Wallet.createRandom().connect(provider)
const dummy = new ethers.Wallet.createRandom()
const EVMPP = "0x5555555555555555555555555555555555555555"

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
    let wallet
    let c
    let chainId
    let gasPrice
    before(async () => {
        [wallet, { chainId }, gasPrice] = await Promise.all([
            getWallet(__filename, provider),
            provider.getNetwork(),
            provider.getGasPrice(),
        ])
        // make sure the gasPrice is more than sufficient for any network fluctuation
        gasPrice = gasPrice.mul(4)
        c = new ethers.Contract(EVMPP, result.abi, wallet)
    })

    it('tx fee payed', async function () {
        const [nonce, walletNonce] = await Promise.all([
            nocoin.getTransactionCount('pending'),
            wallet.getTransactionCount('pending'),
        ])

        const tx = {
            chainId,
            to: dummy.address,
            gasLimit: 21000,
            gasPrice,
            nonce,
        }

        const rawSignedTx = await nocoin.signTransaction(tx)

        await assert.rejects(
            provider.sendTransaction(rawSignedTx),
            { reason: 'insufficient funds for intrinsic transaction cost' },
        )

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
        const receipt = await res.wait(1);
        assert(receipt.gasUsed.gt(21000*2), 'double intrinsic gas')

        const [a, b] = await Promise.all([
            wallet.getTransactionCount('pending'),
            nocoin.getTransactionCount('pending'),
        ])

        assert.equal(a, walletNonce + 1, "fee payer nonce must be increased")
        assert.equal(b, nonce + 1, "fee payee nonce must be increased")

        await assert.rejects(c.callStatic.call(
            t.to,
            t.data,
            t.nonce,
            t.gasLimit,
            t.v, t.r, t.s, {
            gasPrice,
            value: ethers.utils.parseEther('30')
        },
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
            gasPrice,
            nonce: nonce + 1,
        }

        const rawSignedTx = await nocoin.signTransaction(tx)
        const t = ethers.utils.parseTransaction(rawSignedTx)

        await assert.rejects(c.callStatic.call(
            t.to,
            t.data,
            t.nonce,
            t.gasLimit,
            t.v, t.r, t.s, {
            gasPrice: gasPrice,
            value: ethers.utils.parseEther('30')
        },
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
                gasPrice,
                nonce,
            }

            const rawSignedTx = await nocoin.signTransaction(tx)

            const t = ethers.utils.parseTransaction(rawSignedTx)

            await assert.rejects(c.callStatic.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                0,
                t.r,
                t.s,
                {
                    gasPrice: gasPrice,
                    value: ethers.utils.parseEther('30')
                },
            ), { reason: 'payee: invalid signature' }, 'invalid V')

            await assert.rejects(c.callStatic.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                t.v,
                0,
                t.s,
                {
                    gasPrice: gasPrice,
                    value: ethers.utils.parseEther('30')
                },
            ), { reason: 'payee: invalid signature' }, 'invalid R')

            await assert.rejects(c.callStatic.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                t.v,
                t.r,
                0,
                {
                    gasPrice: gasPrice,
                    value: ethers.utils.parseEther('30')
                },
            ), { reason: 'payee: invalid signature' }, 'invalid S')
        });

        it('incorrect signature', async function () {
            nonce = await nocoin.getTransactionCount('pending')

            const tx = {
                chainId,
                to: to,
                gasLimit: 21000,
                gasPrice,
                nonce,
            }

            const rawSignedTx = await nocoin.signTransaction(tx)

            const t = ethers.utils.parseTransaction(rawSignedTx)

            await c.call(
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

            assert.equal(await nocoin.getTransactionCount('pending'), nonce, "fee payee nonce must not be increased")
        });

    });


    it('balance change', async function () {
        const [nonce, balanceBefore] = await Promise.all([
            nocoin.getTransactionCount('pending'),
            provider.getBalance(nocoin.address),
        ])

        const tx = {
            chainId,
            to: dummy.address,
            gasLimit: 21000,
            gasPrice,
            nonce,
        }

        const rawSignedTx = await nocoin.signTransaction(tx)

        const t = ethers.utils.parseTransaction(rawSignedTx)

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
                value: ethers.utils.parseEther('30'),
                gasLimit: 100000
            },
        )

        const receipt = await res.wait(1);
        assert(receipt.gasUsed.gt(21000*2), 'double intrinsic gas')

        const balanceAfter = await provider.getBalance(await nocoin.getAddress());
        assert(balanceBefore.eq(balanceAfter), "payee balance must be unchanged")
        assert(balanceBefore.sub(ethers.utils.parseEther('30')).lt(balanceAfter), "payer balance must be decreased")
    });


    describe('Batch Tx', function () {
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
                to: EVMPP,
                gasLimit: 30000,
                gasPrice,
                nonce,
                data: iface.encodeFunctionData("call", [txs])
            }

            const rawSignedTx = await nocoin.signTransaction(tx)

            const walletNonce = await wallet.getTransactionCount('pending')
            const t = ethers.utils.parseTransaction(rawSignedTx)

            const res = await c.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                t.v, t.r, t.s,
                {
                    gasPrice,
                    value: ethers.utils.parseEther('30')
                },
            )
            const receipt = await res.wait(1);
            assert(receipt.gasUsed.gt(21000*2), 'double intrinsic gas')

            assert.equal(await wallet.getTransactionCount('pending'), walletNonce + 1, "fee payer nonce must be increased")
            assert.equal(await nocoin.getTransactionCount('pending'), nonce + 1, "fee payee nonce must be increased")

            await assert.rejects(c.callStatic.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                t.v, t.r, t.s,
                {
                    gasPrice,
                    value: ethers.utils.parseEther('30')
                },
            ), { reason: 'payee: invalid nonce' }, 'payee replay protection')
        });



        it('balance', async function () {
            const nonce = await nocoin.getTransactionCount('pending')

            const tx = {
                chainId,
                to: EVMPP,
                gasLimit: 40000,
                gasPrice,
                nonce,
                data: iface.encodeFunctionData("call", [txs])
            }

            const rawSignedTx = await nocoin.signTransaction(tx)
            const t = ethers.utils.parseTransaction(rawSignedTx)

            const balance1Before = await provider.getBalance("0x7dcA4B509c9F5296264d615147581c36db81A3f8");
            const balance2Before = await provider.getBalance("0x348145b162bE7865Dd32DADF3C2E193dc1450489");
            const balance3Before = await provider.getBalance("0xBEa3eF61735cb5d48112DB218eACF95bb9cA4D2C");

            const res = await c.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                t.v, t.r, t.s,
                {
                    gasPrice,
                    value: ethers.utils.parseEther('30')
                },
            )
            const receipt = await res.wait(1);
            assert(receipt.gasUsed.gt(21000*2), 'double intrinsic gas')

            const balance1After = await provider.getBalance("0x7dcA4B509c9F5296264d615147581c36db81A3f8");
            const balance2After = await provider.getBalance("0x348145b162bE7865Dd32DADF3C2E193dc1450489");
            const balance3After = await provider.getBalance("0xBEa3eF61735cb5d48112DB218eACF95bb9cA4D2C");

            assert.equal(balance1After.sub(balance1Before).toString(), ethers.utils.parseEther('1').toString(), 'balance 1');
            assert.equal(balance2After.sub(balance2Before).toString(), ethers.utils.parseEther('2').toString(), 'balance 2');
            assert.equal(balance3After.sub(balance3Before).toString(), ethers.utils.parseEther('3').toString(), 'balance 3');
        });

    });


    describe('ERC20', function () {
        // let erc20, wallet;

        const batchTx = compile(`
        struct Tx {
            address to;
            bytes  data;
            uint256 value;	// ether value to transfer
        }
        function call(Tx[] calldata txs) external returns (bytes[] memory results) {}
    `)
        let iface = new ethers.utils.Interface(batchTx.abi)


        it('transfer must be successfully', async function () {
            const erc20 = await deploy('ERC20.sol', wallet, ethers.utils.parseUnits("100"))

            const [nonce] = await Promise.all([
                nocoin.getTransactionCount('pending'),
            ])

            const r = await erc20.transfer(nocoin.address, "10")
            await r.wait(1)

            const tx = {
                chainId,
                to: erc20.address,
                gasLimit: 60000,
                data: erc20.interface.encodeFunctionData("transfer", ["0x1234567890123456789012345678901234567890", 4]),
                gasPrice,
                nonce,
            }

            const beforeBalance = await erc20.balanceOf(nocoin.address)

            const rawSignedTx = await nocoin.signTransaction(tx)

            const t = ethers.utils.parseTransaction(rawSignedTx)

            const res = await c.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                t.v, t.r, t.s,
                { gasPrice: gasPrice },
            )

            const receipt = await res.wait(1);
            assert(receipt.gasUsed.gt(21000*2), 'double intrinsic gas')
            const afterBalance = await erc20.balanceOf(nocoin.address)

            assert.equal(beforeBalance.sub(afterBalance), 4, 'Balance must be decreased by 4')
        });



        it('transfer must be failed', async function () {
            const erc20 = await deploy('ERC20.sol', wallet, ethers.utils.parseUnits("100"))

            const [nonce] = await Promise.all([
                nocoin.getTransactionCount('pending'),
            ])

            const tx = {
                chainId,
                to: erc20.address,
                gasLimit: 21000,
                data: erc20.interface.encodeFunctionData("transfer", ["0x1234567890123456789012345678901234567890", 4]),
                gasPrice,
                nonce,
            }

            const rawSignedTx = await nocoin.signTransaction(tx)

            const t = ethers.utils.parseTransaction(rawSignedTx)

            await assert.rejects(c.callStatic.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                t.v, t.r, t.s,
                { gasPrice },
            ), { reason: "payee: intrinsic gas too low" })
        });


        it('batch TX', async function () {
            const erc20 = await deploy('ERC20.sol', wallet, ethers.utils.parseUnits("100"))

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

            const nonce = await nocoin.getTransactionCount('pending')

            const r = await erc20.transfer(nocoin.address, "10")
            let receipt = await r.wait(1);
            assert(receipt.gasUsed.gt(21000*2), 'double intrinsic gas')

            const tx = {
                chainId,
                to: EVMPP,
                gasLimit: 70000,
                data: iface.encodeFunctionData("call", [txs]),
                gasPrice,
                nonce,
            }

            const balanceBefore = await erc20.balanceOf(nocoin.address)
            const balance2Before = await erc20.balanceOf("0x202359E874C243012710Bd5e61db43b1f3F5c02c");
            const balance3Before = await erc20.balanceOf("0xf36fE0A7dB833798b743819803a91C7AeDDF3c43");

            const rawSignedTx = await nocoin.signTransaction(tx)

            const t = ethers.utils.parseTransaction(rawSignedTx)

            const res = await c.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                t.v, t.r, t.s,
                { gasPrice },
            )

            receipt = await res.wait(1);
            assert(receipt.gasUsed.gt(21000*2), 'double intrinsic gas')

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
            assert(receipt.gasUsed.gt(21000*2), 'double intrinsic gas')

            const tx = {
                chainId,
                to: erc20.address,
                gasLimit: 21000,
                data: erc20.interface.encodeFunctionData("transfer", ["0x1234567890123456789012345678901234567890", 4]),
                gasPrice,
                nonce,
            }

            const beforeBalance = await erc20.balanceOf(nocoin.address)

            const rawSignedTx = await nocoin.signTransaction(tx)

            const t = ethers.utils.parseTransaction(rawSignedTx)

            await assert.rejects(c.callStatic.call(
                t.to,
                t.data,
                nonce,
                t.gasLimit,
                t.v, t.r, t.s,
                { gasPrice },
            ), { reason: "payee: intrinsic gas too low" })
        });



    });


});
