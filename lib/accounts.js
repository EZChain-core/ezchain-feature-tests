const { ethers } = require('ethers');

var keys = ['0x66d38a91b9e16cd96cc7768fb4481ed9817bc6f6e7ac5e173e8ddb3218139b64',
    '0x819c949c1ba520dc0227f26e4ca64b5bc34636e0488b10090b3f0daf41c28197',
    '0x91cbfb5e6a635e109cc93ed29e315e96333d80a91288d872cc8b38862a58991e',
    '0x783bc38a23be2c723153e8873f0a8e7ed4c53bd8c93a95a6cc89820ba53f1a68',
    '0x281bc885fb637190e5a61087073c9bb0f095106813839bcc51e86eddbfe9234d',
    '0xc24087301c3d712c60ec2739670ebea4b8c0192fda70cbeda52946aab85157e7',
    '0x5ac46984c12c5b16ef507b3908bee03424c052970116d69c460b45c44d27c602',
    '0xcd109a1393b4a3ac461bfb9528b709e325740130113ae40b63a871e66281a903',
    '0xad5227941437eeb8623de6b8fd6b933278f82e47fd2e2b957a9906ff115b9948',
    '0x20c6b49abe13e498bb9d38d822ab2b42d350ecbefe46fb8b06b381dc7b8c1c88',
    '0xe5b50a8de2a4802874ba28718347ca4d4007128c8a80943b4901809a2e3590fb',
    '0x308f3c76495e379a13d1ebe3d68a8df71ec448b9787731acc8691bfd9ac37b71',
    '0x5163d9c3ea4b89124d9c36e73361878266bfdbaf2df0407af873d9cc06c3afae',
    '0xb28f123ff542afc2495f926e8dd52ba2a3efa115204faefdd53c089445b3f5a0',
    '0x89372b3639f26b3023e1ac6b186ce663a51ddf91451c704edba21f6a20f75bec',
    '0xfae2ef33b6a19f4d401c90677520595ae3cc0670206e8d4c5514656cc8143606',
    '0x3e38999aa75040e40b342d0aff971acd59b93b48e06f2fdebf3ee998260bfd66',
]

function getWallets(provider) {
    let wallets = [];

    for (const key of keys) {
        const wallet = new ethers.Wallet(key, provider)
        wallets.push(wallet)
    }
    return wallets
}



async function fundAccounts(fromWallet, wallets, amount, provider) {
    amount = ethers.utils.parseEther(amount)

    for (const wallet of wallets) {
        const to = await wallet.getAddress();
        let balance = await provider.getBalance(to);

        if (balance.lt(amount)) {
            const res = await fromWallet.sendTransaction({
                to: to,
                value: amount,
            });
            receipt = await res.wait(1);
        }
    }
}

exports.getWallets = getWallets;
exports.fundAccounts = fundAccounts;
