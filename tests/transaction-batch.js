const { ethers } = require('ethers');
const { assert } = require('console');
const { compile } = require('../lib/solc_util')
const { deploy } = require('../lib/solc_util')
const { parseReturnedDataWithLogs } = require('../lib/parse_util')

const RPC = process.env.RPC || "http://localhost:9650/ext/bc/C/rpc"
const provider = new ethers.providers.JsonRpcProvider({ url: RPC, timeout: 6000 })
const wallet = new ethers.Wallet("0x56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027", provider)
const from = "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"
const EVMPP = "0x5555555555555555555555555555555555555555"
const accessList = [{ address: EVMPP }]


const result = compile(`
    struct Tx {
        address to;
        bytes  data;
        uint256 value;	// ether value to transfer
    }
    function call(Tx[] calldata txs) external returns (bytes[] memory results) {}
`)

let iface = new ethers.utils.Interface(result.abi)

async function sendBatchTx(from, recipients, accessList = []) {
    const txs = recipients.map(function (recipient) {
        if (!recipient.data) {
            recipient.data = '0x'
        }
        recipient.data = ethers.utils.arrayify(recipient.data);
        return recipient;
    })

    const data = iface.encodeFunctionData("call", [txs])

    const res = await wallet.sendTransaction({
        from: from,
        to: EVMPP,
        data: data,
        accessList: accessList
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
        accessList: accessList
    });

    return res
}


async function it() {
    console.log(require('path').basename(__filename))

    // Multisend
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

        const balance1Before = await provider.getBalance("0xc233de409e6463932de0b21187855a61dbba0416");
        const balance2Before = await provider.getBalance("0xa12a9128b30ca44ef11749dffe18a6c94c9c58a6");
        const balance3Before = await provider.getBalance("0x1234567890123456789012345678901234567890");

        try {
            const res = await sendBatchTx(from, recipients)
            await res.wait(1)
        } catch (err) {
            console.error('failed to send batchTX', err)
            return false
        }


        const balance1After = await provider.getBalance("0xc233de409e6463932de0b21187855a61dbba0416");
        const balance2After = await provider.getBalance("0xa12a9128b30ca44ef11749dffe18a6c94c9c58a6");
        const balance3After = await provider.getBalance("0x1234567890123456789012345678901234567890");

        assert(balance1After - balance1Before == ethers.utils.parseEther('1'), 'multisend: Incorrect balance1 after sending')
        assert(balance2After - balance2Before == ethers.utils.parseEther('2'), 'multisend: Incorrect balance2 after sending')
        assert(balance3After - balance3Before == ethers.utils.parseEther('3'), 'multisend: Incorrect balance3 after sending')
    }


    // Approve and call
    {
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


        try {
            const res = await sendBatchTx(from, recipients, [{ address: erc20.address }])
            await res.wait(1)
        } catch (err) {
            console.error('failed to send batchTX', err)
            return false
        }

        const afterBalance = await erc20.balanceOf(signerAddr)
        assert(beforeBalance.sub(afterBalance) == 20, 'Approve and call: incorrect balance after spending')
    }


    // Call and get logs
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

        var res;
        try {
            res = await callBatchTx(from, recipients)

            const [signature, msg] = parseReturnedDataWithLogs(res)
            assert(msg.logs?.length > 0, 'call batchTx and get logs: empty logs')

        } catch (err) {
            console.error('failed to call batchTX', err)
            return false
        }
    }

    // High Level Call and Results
    {
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

        try {
            const i = await c.callStatic.call([{
                to: contractString.address,
                data: contractString.interface.encodeFunctionData("returnString", ["hello"]),
                value: 0
            }, {
                to: contractInt.address,
                data: contractInt.interface.encodeFunctionData("returnInt", [6]),
                value: 0
            }])

            assert(i == 13 + 6, 'incorrect second return value')
        } catch (err) {
            console.error('failed to callStatic', err)
            return false
        }
    }


    // High Level Call and Results (contract return multiple values)
    {
        const contractStringInt = await deploy(`
        function returnStringInt(string calldata s) external returns (string calldata, int) {
            require(bytes(s).length > 0, "string must not empty");
            return (s, 1);
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
            function call(Tx[] calldata txs) external returns (string memory, int) {}
            function something(Tx[] calldata txs) external returns (string memory, int) {}
            function somethingElse() external returns (string memory, int) {}
        `)

        const c = new ethers.Contract(EVMPP, result.abi, provider)

        try {
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

            assert(res == "0x", 'call to non-batch function must return 0x')

        } catch (err) {
            console.error('failed to callStatic', err)
            return false
        }

        try {
            const res = await provider.call({
                to: EVMPP,
                value: 0,
                data: c.interface.encodeFunctionData("somethingElse", []),
            })

            assert(res == "0x", 'call to non-batch function must return 0x')

        } catch (err) {
            console.error('failed to callStatic', err)
            return false
        }

        try {
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

            assert(s == "test", 'incorrect first return value')
            assert(i == 1, 'incorrect second return value')

        } catch (err) {
            console.error('failed to callStatic', err)
            return false
        }

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

            assert(false, 'this code should not executed')

        } catch (err) {
            assert(err?.reason == 'string must not empty', 'revert reason not match')
        }

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

            assert(false, 'this code should not executed')

        } catch (err) {
            assert(err?.reason == 'must be positive integer', 'revert reason not match')
        }
    }

    console.log(`\tsuccess`)
}

it()