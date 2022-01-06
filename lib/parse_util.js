const { ethers } = require('ethers');


exports.parseReturnedDataWithLogs = (res) => {
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