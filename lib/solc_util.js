const { ethers } = require('ethers');
const solc = require('solc')

exports.compile = (content) => {
    const input = {
        language: 'Solidity',
        sources: {
            'test.sol': {
                content: 'contract C {' + content + '}',
            },
        },
        settings: {
            outputSelection: {
                "*": {
                    "*": [ "abi", "evm.bytecode.object" ]
                },
            }
        }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    const errors = output.errors.filter(err => err.severity == 'error')
    if (errors.length) {
        throw errors
    }

    return {
        abi: output.contracts['test.sol'].C.abi,
        bytecode: output.contracts['test.sol'].C.evm.bytecode.object,
    }
}

exports.deploy = async (content, signer, value) => {
    const { abi, bytecode } = exports.compile(content)
    const factory = new ethers.ContractFactory(abi, bytecode, signer)
    const contract = await factory.deploy({ value })
    await contract.deployTransaction.wait()
    return contract
}
