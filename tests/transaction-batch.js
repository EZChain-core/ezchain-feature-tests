const { ethers } = require('ethers');
const { assert } = require('console');
const { compile } = require('../lib/solc_util')

const RPC = process.env.RPC || "http://localhost:9650/ext/bc/C/rpc"
const provider = new ethers.providers.JsonRpcProvider({ url: RPC, timeout: 6000 })
const wallet = new ethers.Wallet("0x56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027", provider)
const from = "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"


const result = compile(`
    struct Tx {
        address to;
        bytes  data;
        uint256 value;	// ether value to transfer
    }
    function callBatch(Tx[] calldata txs) external returns (bytes[] memory results) {}
`)

let iface = new ethers.utils.Interface(result.abi)

async function sendBatchTx(from, recipients) {
    const txs = recipients.map(function (recipient) {
        if (!recipient.data) {
            recipient.data = '0x'
        }
        recipient.data = ethers.utils.arrayify(recipient.data);
        return recipient;
    })

    const data = iface.encodeFunctionData("callBatch", [txs])

    const res = await wallet.sendTransaction({
        from: from,
        to: "0x5555555555555555555555555555555555555555",
        data: data
    })

    return res
}


async function it() {
    console.log(require('path').basename(__filename))

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

    const res = await sendBatchTx(from, recipients)

    const receipt = await res.wait(1)
    console.log(receipt)

    console.log(`\tsuccess`)
}

it()


