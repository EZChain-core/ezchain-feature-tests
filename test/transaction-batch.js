const { ethers } = require('ethers');
const { compile } = require('../lib/solc_util')
const { deploy } = require('../lib/solc_util')

const { parseReturnedDataWithLogs } = require('../lib/parse_util')
const { getWallets } = require('../lib/accounts')
const { fundAccounts } = require('../lib/accounts')
const RPC = process.env.RPC || "http://localhost:9650/ext/bc/C/rpc"
const provider = new ethers.providers.JsonRpcProvider({ url: RPC, timeout: 6000 })
const wallet = new ethers.Wallet("0x56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027", provider)
const from = "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"
const EVMPP = "0x5555555555555555555555555555555555555555"
const callLogsAccessList = [{
    address: "0x5555555555555555555555555555555555555555",
    storageKeys: ["0x5555555555555555555555555555555555555555555555555555555555555555"],
}]

var assert = require('assert');

var wallets = getWallets(provider);


const result = compile(`
    struct Tx {
        address to;
        bytes  data;
        uint256 value;	// ether value to transfer
    }
    function call(Tx[] calldata txs) external returns (bytes[] memory results) {}
`)

let iface = new ethers.utils.Interface(result.abi)

async function sendBatchTx(wallet, recipients, accessList = [], gasLimit = null) {

    const txs = recipients.map(function (recipient) {
        if (!recipient.data) {
            recipient.data = '0x'
        }
        recipient.data = ethers.utils.arrayify(recipient.data);
        return recipient;
    })

    const data = iface.encodeFunctionData("call", [txs])

    const res = await wallet.sendTransaction({
        to: EVMPP,
        data: data,
        accessList: accessList,
        gasLimit: gasLimit
    })

    return res
}


async function callBatchTx(from, recipients) {
    const txs = recipients.map(function (recipient) {
        if (!recipient.data) {
            recipient.data = '0x'
        }
        recipient.data = ethers.utils.arrayify(recipient.data);
        return recipient;
    })

    const data = iface.encodeFunctionData("call", [txs])

    const res = await provider.call({
        to: EVMPP,
        from: from,
        data: data,
        accessList: callLogsAccessList
    });

    return res
}


async function estimateBatchTxGas(from, recipients) {
    const txs = recipients.map(function (recipient) {
        if (!recipient.data) {
            recipient.data = '0x'
        }
        recipient.data = ethers.utils.arrayify(recipient.data);
        return recipient;
    })

    const data = iface.encodeFunctionData("call", [txs])

    const res = await provider.estimateGas({
        to: EVMPP,
        from: from,
        data: data
    });

    return res
}


before(async () => {
    await fundAccounts(wallet, wallets, "40000", provider);
})



describe('Batch Transaction', function () {

    describe('Multisend', function () {
        it('Balance should be added after sending', async function () {
            const recipients = [
                {
                    to: "0x232544a805249cCd5A81Dbb8c457F46fC24E7821",
                    value: ethers.utils.parseEther('1')
                },
                {
                    to: "0x202359E874C243012710Bd5e61db43b1f3F5c02c",
                    value: ethers.utils.parseEther('2')
                },
                {
                    to: "0xf36fE0A7dB833798b743819803a91C7AeDDF3c43",
                    value: ethers.utils.parseEther('3')
                }
            ]
            const wallet = wallets.pop();

            const balance1Before = await provider.getBalance("0x232544a805249cCd5A81Dbb8c457F46fC24E7821");
            const balance2Before = await provider.getBalance("0x202359E874C243012710Bd5e61db43b1f3F5c02c");
            const balance3Before = await provider.getBalance("0xf36fE0A7dB833798b743819803a91C7AeDDF3c43");

            const res = await sendBatchTx(wallet, recipients)
            await res.wait(1)

            const balance1After = await provider.getBalance("0x232544a805249cCd5A81Dbb8c457F46fC24E7821");
            const balance2After = await provider.getBalance("0x202359E874C243012710Bd5e61db43b1f3F5c02c");
            const balance3After = await provider.getBalance("0xf36fE0A7dB833798b743819803a91C7AeDDF3c43");

            assert.equal(balance1After - balance1Before, ethers.utils.parseEther('1'));
            assert.equal(balance2After - balance2Before, ethers.utils.parseEther('2'));
            assert.equal(balance3After - balance3Before, ethers.utils.parseEther('3'));
        });

    });


    // Approve and call
    describe('Approve and call', function () {
        it('balance must be subtracted after spending', async function () {
            const wallet = wallets.pop();

            const erc20 = await deploy('ERC20.sol', wallet, ethers.utils.parseUnits("100"))
            const thirdParty = await deploy('thirdParty.sol', wallet)
            const signerAddr = erc20.signer.address
            const beforeBalance = await erc20.balanceOf(signerAddr)

            recipients = [
                {
                    to: erc20.address,
                    value: 0,
                    data: erc20.interface.encodeFunctionData("approve", [thirdParty.address, 40])
                },
                {
                    to: thirdParty.address,
                    value: 0,
                    data: thirdParty.interface.encodeFunctionData("spendToken",
                        [erc20.address, signerAddr, "0xc233de409e6463932de0b21187855a61dbba0416", 10])
                },
                {
                    to: thirdParty.address,
                    value: 0,
                    data: thirdParty.interface.encodeFunctionData("spendToken",
                        [erc20.address, signerAddr, "0x1234567890123456789012345678901234567890", 10])
                }
            ]


            const res = await sendBatchTx(wallet, recipients, [{ address: erc20.address }])
            await res.wait(1)

            const afterBalance = await erc20.balanceOf(signerAddr)
            assert.equal(beforeBalance.sub(afterBalance), 20)
        });


    });


    // Call and get logs
    describe('Call and get logs', function () {
        it('Logs must not be empty', async function () {
            {
                recipients = [
                    {
                        to: "0xc233de409e6463932de0b21187855a61dbba0416",
                        value: ethers.utils.parseEther('1')
                    },
                    {
                        to: "0xa12a9128b30ca44ef11749dffe18a6c94c9c58a6",
                        value: ethers.utils.parseEther('2')
                    },
                    {
                        to: "0x1234567890123456789012345678901234567890",
                        value: ethers.utils.parseEther('3')
                    }
                ]

                const res = await callBatchTx(from, recipients)

                const [signature, msg] = parseReturnedDataWithLogs(res)
                assert(msg.logs?.length > 0)

            }
        });
    });



    // High Level Call and Results
    describe('High Level Call and Results', function () {
        it('incorrect second return value', async function () {
            const wallet = wallets.pop();

            const contractString = await deploy(`
            function returnString(string memory s) external returns (string memory) {
                require(bytes(s).length > 0, "empty string");
                return string(abi.encodePacked(s, " there"));
            }
        `, wallet)

            const contractInt = await deploy(`
            function returnInt(int i) external returns (int) {
                require(i > 0, "must be positive integer");
                return i + 13;
            }
        `, wallet)

            const result = compile(`
            struct Tx {
                address to;
                bytes  data;
                uint256 value;	// ether value to transfer
            }
            function call(Tx[] calldata txs) external returns (int) {}
        `)
            const c = new ethers.Contract(EVMPP, result.abi, provider)

            const i = await c.callStatic.call([{
                to: contractString.address,
                data: contractString.interface.encodeFunctionData("returnString", ["hello"]),
                value: 0
            }, {
                to: contractInt.address,
                data: contractInt.interface.encodeFunctionData("returnInt", [6]),
                value: 0
            }])

            assert(i, 13 == 6);
        });
    });


    // Test returned values
    describe('High Level Call and Results (contract return multiple values)', function () {
        let c, contractInt, contractStringInt;

        before(async function () {
            // runs once before the first test in this block
            contractStringInt = await deploy(`
            function returnStringInt(string calldata s) external returns (string calldata, int) {
                require(bytes(s).length > 0, "string must not empty");
                return (s, 1);
            }
            `, wallet)

            contractInt = await deploy(`
                function returnInt(int i) external returns (int) {
                    require(i > 0, "must be positive integer");
                    return i + 13;
                }
            `, wallet)

            const result = compile(`
                struct Tx {
                    address to;
                    bytes  data;
                    uint256 value;	// ether value to transfer
                }
                function call(Tx[] calldata txs) external returns (string memory, int) {}
                function something(Tx[] calldata txs) external returns (string memory, int) {}
                function somethingElse() external returns (string memory, int) {}
            `)
            c = new ethers.Contract(EVMPP, result.abi, provider)

        });


        it('call to non-batch function must return 0x', async function () {

            const res = await provider.call({
                to: EVMPP,
                value: 0,
                data: c.interface.encodeFunctionData("something", [[{
                    to: contractInt.address,
                    data: contractInt.interface.encodeFunctionData("returnInt", [6]),
                    value: 0
                }, {
                    to: contractStringInt.address,
                    data: contractStringInt.interface.encodeFunctionData("returnStringInt", ["test"]),
                    value: 0
                }]]),
            })

            assert.equal(res, "0x")


        });

        it('call to non-batch function must return 0x', async function () {

            const res = await provider.call({
                to: EVMPP,
                value: 0,
                data: c.interface.encodeFunctionData("somethingElse", []),
            })

            assert.equal(res, "0x")
        });


        it('Return values must be correct', async function () {
            const [s, i] = await c.callStatic.call([
                {
                    to: contractInt.address,
                    data: contractInt.interface.encodeFunctionData("returnInt", [6]),
                    value: 0
                },
                {
                    to: contractStringInt.address,
                    data: contractStringInt.interface.encodeFunctionData("returnStringInt", ["test"]),
                    value: 0
                }])

            assert(s == "test")
            assert(i == 1)
        });


        it('Error reason: string must not empty', async function () {
            try {
                await c.callStatic.call([{
                    to: contractStringInt.address,
                    data: contractStringInt.interface.encodeFunctionData("returnStringInt", [""]),
                    value: 0
                }, {
                    to: contractInt.address,
                    data: contractInt.interface.encodeFunctionData("returnInt", [0]),
                    value: 0
                }])
                assert(false)
            } catch (err) {
                assert.equal(err?.reason, 'string must not empty')
            }
        });


        it('Error reason: must be positive integer', async function () {

            try {
                await c.callStatic.call([{
                    to: contractStringInt.address,
                    data: contractStringInt.interface.encodeFunctionData("returnStringInt", ["test"]),
                    value: 0
                }, {
                    to: contractInt.address,
                    data: contractInt.interface.encodeFunctionData("returnInt", [0]),
                    value: 0
                }])

                assert(false)

            } catch (err) {
                assert(err?.reason == 'must be positive integer')
            }

        });

    });


    // test gas limit
    describe('Test gas limit', function () {
        let contractString, contractInt, c, tx1, tx2, tx3, gas1, gas2, gas3, batchGas;


        before(async function () {
            const wallet = wallets.pop();

            contractString = await deploy(`
            function returnString(string memory s) external returns (string memory) {
                require(bytes(s).length > 0, "empty string");
                return string(abi.encodePacked(s, " there"));
            }
        `, wallet)

            contractInt = await deploy(`
            function returnInt(int i) external returns (int) {
                require(i > 0, "must be positive integer");
                return i + 13;
            }
        `, wallet)


            const result = compile(`
            struct Tx {
                address to;
                bytes  data;
                uint256 value;	// ether value to transfer
            }
            function call(Tx[] calldata txs) external returns (int) {}
        `)
            c = new ethers.Contract(EVMPP, result.abi, provider)


            tx1 = {
                to: contractString.address,
                data: contractString.interface.encodeFunctionData("returnString", ["hello"]),
                value: 0
            }

            tx2 = {
                to: contractInt.address,
                data: contractInt.interface.encodeFunctionData("returnInt", [6]),
                value: 0
            }


            tx3 = {
                to: contractInt.address,
                data: contractInt.interface.encodeFunctionData("returnInt", [6]),
                value: 0
            }

            gas1 = await provider.estimateGas(tx1)
            gas2 = await provider.estimateGas(tx2)
            gas3 = await provider.estimateGas(tx3)

            batchGas = await estimateBatchTxGas(from, [tx1, tx2, tx3])
        });


        it('Estimated BatchTx gas must be correct', function () {
            assert(batchGas.gt(21000 + (gas1 - 21000), (gas2 - 21000), (gas3 - 21000)))
        });


        it('Batch tx must be successful', async function () {
            const wallet = wallets.pop();
            const res = await sendBatchTx(wallet, [tx1, tx2, tx3], [], gasLimit = batchGas)
            await res.wait(1)
        });


        it('Batch Tx must be failed.', async function () {
            try {
                const wallet = wallets.pop();
                const res = await sendBatchTx(wallet, [tx1, tx2, tx3], [], gasLimit = batchGas.sub(1))
                await res.wait(1)
                assert(false)
            } catch (err) {
            }
        });


        it('Tx must be out of gas', async function () {
            try {
                result = await c.callStatic.call([tx1, tx2, tx3], { gasLimit: batchGas.sub(1) })
                assert(false)

            } catch (err) {
                const body = JSON.parse(err.error.body)
                assert(body?.error?.message == 'out of gas')
            }

        });
    });

});










