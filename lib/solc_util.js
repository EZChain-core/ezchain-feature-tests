const { ethers } = require('ethers');
const solc = require('solc')
const path = require('path')
const fs = require('fs')


function findImports(_path) {
    return {
        contents: fs.readFileSync(path.resolve(__dirname + '/../node_modules', _path)).toString()
    }
}

exports.compile = (content) => {
    if (content.endsWith('.sol')) {
        const filePath = path.resolve(__dirname + '/../contracts', content)
        content = fs.readFileSync(filePath, 'utf8')
    } else {
        content = 'contract C {' + content + '}'
    }

    const input = {
        language: 'Solidity',
        sources: {
            'test.sol': {
                content: content,
            },
        },
        settings: {
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode.object"]
                },
            }
        }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

    const errors = output.errors.filter(err => err.severity == 'error')
    if (errors.length) {
        throw errors
    }

    return {
        abi: output.contracts['test.sol'].C.abi,
        bytecode: output.contracts['test.sol'].C.evm.bytecode.object,
    }
}

exports.deploy = async (content, signer, ...args) => {
    const { abi, bytecode } = exports.compile(content)
    const factory = new ethers.ContractFactory(abi, bytecode, signer)
    const contract = await factory.deploy(...args)
    await contract.deployTransaction.wait()
    return contract
}
