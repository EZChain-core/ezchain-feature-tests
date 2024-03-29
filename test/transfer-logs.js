const { ethers } = require('ethers');
const { AddressZero } = ethers.constants
const { deploy } = require('../lib/solc_util')
const { getWallet } = require('../lib/accounts')

const RPC = process.env.RPC || "http://localhost:9650/ext/bc/C/rpc"
const provider = new ethers.providers.JsonRpcProvider({ url: RPC, timeout: 6000 })
const onetwo = '0x1234567890123456789012345678901234567890'
var assert = require('assert');


describe('Transfer logs', function () {
    let wallet
    before(async () => {
        wallet = await getWallet(__filename, provider)
    })

    describe('Transfer', function () {
        let blockNumber, receipt;

        before(async function () {
            const res = await wallet.sendTransaction({
                to: onetwo,
                value: ethers.utils.parseEther('12.34'),
            })

            receipt = await res.wait(1);
            blockNumber = receipt.blockNumber
        });


        it('eth transfer receipt logs must be 1', function () {
            assert.equal(receipt.logs?.length, 1)
        });


        it('getLogs (address) must found tx hash', async function () {
            const logs = await provider.getLogs({
                fromBlock: blockNumber - 10,
                toBlock: blockNumber,
                address: AddressZero,
            })
            assert(logs?.some(log => log.transactionHash == receipt.transactionHash));
        });

        it('getLogs (Transfer) must found tx hash', async function () {
            const logs = await provider.getLogs({
                fromBlock: blockNumber - 5,
                topics: [
                    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                ],
            })
            assert(logs?.some(log => log.transactionHash == receipt.transactionHash));
        });

        it('getLogs (from) must found tx hash', async function () {
            const logs = await provider.getLogs({
                fromBlock: blockNumber - 15,
                topics: [
                    null,
                    ethers.utils.hexZeroPad(wallet.address, 32),
                ],
            })
            assert(logs?.some(log => log.transactionHash == receipt.transactionHash));
        });

        it('getLogs (to) must found tx hash', async function () {
            const logs = await provider.getLogs({
                fromBlock: blockNumber - 15,
                topics: [
                    null,
                    null,
                    ethers.utils.hexZeroPad(onetwo, 32),
                ],
            })
            assert(logs?.some(log => log.transactionHash == receipt.transactionHash))
        });


        it('getLogs out range found tx hash', async function () {
            const logs = await provider.getLogs({
                fromBlock: blockNumber - 15,
                toBlock: blockNumber - 1,
            })
            assert(!logs?.some(log => log.transactionHash == receipt.transactionHash))
        });
    });


    describe('Contract call', function () {
        let contract;

        before(async function () {
            contract = await deploy(`
                function doTransfer(address payable to) payable external {
                    to.transfer(msg.value);
                }

                function doNothing() payable external {
                }
            `, wallet)
        });

        describe('transfer call with value', function() {
            let receipt, blockNumber;

            before(async function () {
                const res = await contract.doTransfer(AddressZero, { value: 123 })
                receipt = await res.wait(1)
                blockNumber = receipt.blockNumber
            });
    
            it('transfer log receipt', function () {
                assert.equal(receipt.logs?.length, 2)
            });
    
            it('getLogs (address) <= 2', async function () {
                const logs = await provider.getLogs({
                    fromBlock: blockNumber - 5,
                    topics: [
                        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                    ],
                })
                assert.equal(logs?.filter(log => log.transactionHash == receipt.transactionHash)?.length, 2)
            });
        })

        describe('do nothing with value', function() {
            let receipt, blockNumber;

            before(async function () {
                const res = await contract.doNothing({ value: 123 })
                receipt = await res.wait(1)
                blockNumber = receipt.blockNumber
            });
    
            it('transfer log receipt', function () {
                assert.equal(receipt.logs?.length, 1)
            });
    
            it('getLogs (address) <= 2', async function () {
                const logs = await provider.getLogs({
                    fromBlock: blockNumber - 5,
                    topics: [
                        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                    ],
                })
                assert.equal(logs?.filter(log => log.transactionHash == receipt.transactionHash)?.length, 1)
            });
        })

        describe('do nothing without value', function() {
            let receipt, blockNumber;

            before(async function () {
                const res = await contract.doNothing()
                receipt = await res.wait(1)
                blockNumber = receipt.blockNumber
            });
    
            it('transfer log receipt', function () {
                assert.equal(receipt.logs?.length, 0)
            });
    
            it('getLogs (address) <= 2', async function () {
                const logs = await provider.getLogs({
                    fromBlock: blockNumber - 5,
                    topics: [
                        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                    ],
                })
                assert.equal(logs?.filter(log => log.transactionHash == receipt.transactionHash)?.length, 0)
            });
        })

    });
});

