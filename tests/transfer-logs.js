const { ethers } = require('ethers');
const { AddressZero } = ethers.constants
const { assert } = require('console');
const { deploy } = require('../lib/solc_util')

const RPC = process.env.RPC || "http://localhost:9650/ext/bc/C/rpc"
const provider = new ethers.providers.JsonRpcProvider({ url: RPC, timeout: 6000 })
const ewoq = new ethers.Wallet("0x56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027", provider)
const onetwo = '0x1234567890123456789012345678901234567890'

async function it() {
    console.log(require('path').basename(__filename))

    const res = await ewoq.sendTransaction({
        to: onetwo,
        value: ethers.utils.parseEther('12.34'),
    })

    const receipt = await res.wait(1)
    assert(receipt.logs?.length == 1, 'eth transfer receipt logs != 1')

    const blockNumber = receipt.blockNumber

    try {
        const logs = await provider.getLogs({
            fromBlock: blockNumber-10,
            toBlock: blockNumber,
            address: AddressZero,
        })
        assert(logs?.some(log => log.transactionHash == receipt.transactionHash), 'getLogs (address) not found tx hash')
    } catch(err) {
        console.error('getLogs (address)', err)
        return false
    }

    try {
        const logs = await provider.getLogs({
            fromBlock: blockNumber-5,
            topics: [
                '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
            ],
        })
        assert(logs?.some(log => log.transactionHash == receipt.transactionHash), 'getLogs (Transfer) not found tx hash')
    } catch(err) {
        console.error('getLogs (Transfer)', err)
        return false
    }

    try {
        const logs = await provider.getLogs({
            fromBlock: blockNumber-15,
            topics: [
                null,
                ethers.utils.hexZeroPad(ewoq.address, 32),
            ],
        })
        assert(logs?.some(log => log.transactionHash == receipt.transactionHash), 'getLogs (from) not found tx hash')
    } catch(err) {
        console.error('getLogs (from)', err)
        return false
    }

    try {
        const logs = await provider.getLogs({
            fromBlock: blockNumber-15,
            topics: [
                null,
                null,
                ethers.utils.hexZeroPad(onetwo, 32),
            ],
        })
        assert(logs?.some(log => log.transactionHash == receipt.transactionHash), 'getLogs (to) not found tx hash')
    } catch(err) {
        console.error('getLogs (to)', err)
        return false
    }

    try {
        const logs = await provider.getLogs({
            fromBlock: blockNumber-15,
            toBlock: blockNumber-1,
        })
        assert(!logs?.some(log => log.transactionHash == receipt.transactionHash), 'getLogs out range found tx hash')
    } catch(err) {
        console.error('getLogs out range', err)
        return false
    }

    try {
        const contract = await deploy(`
            function doTransfer(address payable to, uint amount) payable external {
                to.transfer(amount);
            }
        `, ewoq)

        const res = await contract.doTransfer(AddressZero, ethers.utils.parseEther('1.23'), { value: ethers.utils.parseEther('2.34') })
        const receipt = await res.wait(1)

        assert(receipt.logs?.length == 2, 'contract reciept and send eth logs != 2')

        const blockNumber = receipt.blockNumber

        try {
            const logs = await provider.getLogs({
                fromBlock: blockNumber-5,
                topics: [
                    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                ],
            })
            assert(logs?.filter(log => log.transactionHash == receipt.transactionHash)?.length >= 2, 'getLogs (address) <= 2')
        } catch(err) {
            console.error('contract reciept and send eth: getLogs (Transfer)', err)
            return false
        }
    } catch(err) {
        console.error('transfer in contract call', err)
        return false
    }

    console.log(`\tsuccess`)
}

it()
