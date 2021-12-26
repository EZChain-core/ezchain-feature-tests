const { ethers } = require('ethers');
const fs = require('fs');
const { assert } = require('console');

const RPC = "http://localhost:9650/ext/bc/C/rpc"
const provider = new ethers.providers.JsonRpcProvider({ url: RPC, timeout: 6000 })
const wallet = new ethers.Wallet("0x56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027", provider)

const from = "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"
const to = '0x1234567890123456789012345678901234567890'

const solidityErrorSignature = new Uint8Array([0x08, 0xc3, 0x79, 0xa0]);
const accessList = [{
    address: "0x5555555555555555555555555555555555555555"
}]


function equal(a, b) {
    for (let i = a.length; -1 < i; i -= 1) {
        if ((a[i] !== b[i])) return false;
    }
    return true;
}

function parseReturnedData(res) {
    const bytes = ethers.utils.arrayify(res)
    const lenPos = 4 + 32
    const msgPos = 4 + 32 + 32
    len = ethers.BigNumber.from(ethers.utils.hexlify(bytes.slice(lenPos, lenPos + 32))).toNumber()

    const signature = bytes.slice(0, 4)

    const msg = bytes.slice(msgPos, msgPos + len)

    const jsonString = Buffer.from(msg).toString('utf8')

    const parsedData = JSON.parse(jsonString)

    return [signature, parsedData]
}


async function it() {
    console.log(require('path').basename(__filename))

    // Deploy ERC20 smart contract
    const bytecode = "0x608060405234801561001057600080fd5b506040516103bc3803806103bc83398101604081905261002f9161007c565b60405181815233906000907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9060200160405180910390a333600090815260208190526040902055610094565b60006020828403121561008d578081fd5b5051919050565b610319806100a36000396000f3fe608060405234801561001057600080fd5b506004361061004c5760003560e01c8063313ce5671461005157806370a082311461006557806395d89b411461009c578063a9059cbb146100c5575b600080fd5b604051601281526020015b60405180910390f35b61008e610073366004610201565b6001600160a01b031660009081526020819052604090205490565b60405190815260200161005c565b604080518082018252600781526626bcaa37b5b2b760c91b6020820152905161005c919061024b565b6100d86100d3366004610222565b6100e8565b604051901515815260200161005c565b3360009081526020819052604081205482111561014b5760405162461bcd60e51b815260206004820152601a60248201527f696e73756666696369656e7420746f6b656e2062616c616e6365000000000000604482015260640160405180910390fd5b336000908152602081905260408120805484929061016a9084906102b6565b90915550506001600160a01b0383166000908152602081905260408120805484929061019790849061029e565b90915550506040518281526001600160a01b0384169033907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9060200160405180910390a350600192915050565b80356001600160a01b03811681146101fc57600080fd5b919050565b600060208284031215610212578081fd5b61021b826101e5565b9392505050565b60008060408385031215610234578081fd5b61023d836101e5565b946020939093013593505050565b6000602080835283518082850152825b818110156102775785810183015185820160400152820161025b565b818111156102885783604083870101525b50601f01601f1916929092016040019392505050565b600082198211156102b1576102b16102cd565b500190565b6000828210156102c8576102c86102cd565b500390565b634e487b7160e01b600052601160045260246000fdfea2646970667358221220d80384ce584e101c5b92e4ee9b7871262285070dbcd2d71f99601f0f4fcecd2364736f6c63430008040033";
    const abi = [
        "constructor(uint totalSupply)",
        "function transfer(address to, uint amount)"
    ];

    const factory = new ethers.ContractFactory(abi, bytecode, wallet)
    const contract = await factory.deploy(ethers.utils.parseUnits("100"));
    await contract.deployTransaction.wait();

    let iface = new ethers.utils.Interface(abi);

    // call without accessList
    try {
        const res = await provider.call({
            to: contract.address,
            from: from,
            data: iface.encodeFunctionData("transfer", [to, ethers.utils.parseEther("1.0")])
        });

        assert(res == ethers.utils.hexZeroPad('0x1', 32), 'call function: invalid response')
    } catch (err) {
        console.error('call function', err)
        return false
    }

    // call with accessList
    try {
        const res = await contract.callStatic.transfer(to, ethers.utils.parseEther("1.0"), {
            from: from,
            accessList: accessList
        })
        console.error('call function and get logs: logs not found')
        return false
    } catch (err) {
        assert(err.reason, 'call function and get logs: logs not found in reason')
        if (err.reason) {
            const result = JSON.parse(err.reason)
            assert(result.logs?.length > 0, 'call function and get logs: empty logs')
        }
    }


    // call without accessList
    try {
        const res = await provider.call({
            to: to,
            value: ethers.utils.parseEther('1.23'),
            from: from
        });

        assert(res == "0x", 'call eth transfer: invalid response')
    } catch (err) {
        console.error('call eth transfer', err)
        return false
    }

    // call with accessList
    try {
        const res = await provider.call({
            to: to,
            value: ethers.utils.parseEther('1.23'),
            from: from,
            accessList: accessList
        });

        const [signature, msg] = parseReturnedData(res)

        assert(equal(signature, solidityErrorSignature), 'call eth transfer and get logs: invalid signature')
        assert(msg.logs?.length > 0, 'call eth transfer and get logs: empty logs')
    } catch (err) {
        console.error('call eth transfer and get logs', err)
        return false
    }

    console.log(`\tsuccess`)
}

it()
