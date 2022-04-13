const { ethers } = require('ethers');
const { compile } = require('./solc_util')

const EVMPP = "0x5555555555555555555555555555555555555555"

exports.createEVMPP = (signerOrProvider, opts) => {
    let callBatchReturns = ""
    let payForReturns = ""

    if (opts.returns.callBatch) {
        callBatchReturns = `returns (${opts.returns.callBatch})`
    }
    if (opts?.returns?.payFor) {
        payForReturns = `returns (${opts.returns.payFor})`
    }


    const result = compile(`
        struct Tx {
            address to;
            bytes  data;
            uint256 value;	// ether value to transfer
        }
        function callBatch(Tx[] calldata txs) external ${callBatchReturns} {}

        function payFor(
            address to,
            bytes calldata data,
            uint256 nonce,
            uint256 gasLimit,
            uint256 v,      // signature V
            uint256 r,      // signature R
            uint256 s       // signature S
        ) payable external ${payForReturns} {}
    `)

    return new ethers.Contract(EVMPP, result.abi, signerOrProvider)
}
